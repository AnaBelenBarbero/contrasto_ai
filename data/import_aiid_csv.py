"""
AI Incident Tracker — AIID CSV importer.

Parses `directory_ai_incidents_rows.csv` (exported from the AI Incident
Database / AIID directory) and maps every row to an `AIHarmIncident`.

Usage:
    uv run python import_aiid_csv.py                      # preview + write JSON
    uv run python import_aiid_csv.py --upload             # write JSON + upsert to Supabase
    uv run python import_aiid_csv.py --csv path/to/file   # custom CSV path
    uv run python import_aiid_csv.py --out incidents.json # custom output path
    uv run python import_aiid_csv.py --limit 100          # first N rows only (dev)
    uv run python import_aiid_csv.py --dry-run            # parse + validate, no output

Environment variables (required for --upload):
    SUPABASE_URL          Your Supabase project URL
    SUPABASE_SERVICE_KEY  Service role key (not the anon key)

CSV columns used:
    id              Numeric source ID  → slug "aiid-{id}"
    title           Incident headline
    description     Narrative text (may contain embedded newlines)
    image_url       Optional illustration URL
    new_url         Primary source link
    published_date  ISO-8601 date (YYYY-MM-DD); rows with no date are skipped
    external_id     "Incident N" → stored as AIID reference "AIID-N"
    metadata        Pipe-delimited string:
                      deployer: X || developer: Y || harm: Z || source: URL
"""

from __future__ import annotations

import argparse
import csv
import datetime
import json
import os
import re
import sys
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

from models import AIHarmIncident

load_dotenv()

# ── Default paths ──────────────────────────────────────────────────────────────

DEFAULT_CSV = Path(__file__).parent / "directory_ai_incidents_rows.csv"
DEFAULT_OUT = Path(__file__).parent / "aiid_incidents.json"

# ── Harm-category keyword inference ───────────────────────────────────────────
# Each entry is (category_label, [keywords_to_search_in_title_and_description]).
# The first matching category wins unless multiple apply.

_HARM_KEYWORD_MAP: list[tuple[str, list[str]]] = [
    ("safety",        ["crash", "accident", "killed", "death", "injury", "injur",
                       "collide", "collision", "fire", "explosion", "electrocute",
                       "false alarm", "braking", "brake", "nuclear", "missile"]),
    ("bias",          ["bias", "biased", "gender bias", "racial bias", "sexist",
                       "racist", "discrimination", "discriminat", "under-represent",
                       "down-rank", "ranked lower"]),
    ("privacy",       ["privacy", "personal data", "surveillance", "tracking",
                       "face id", "facial recognition", "biometric"]),
    ("misinformation",["misinformation", "hallucin", "false", "fake", "deepfake",
                       "erroneous", "inaccurate", "wrong answer", "citation error"]),
    ("manipulation",  ["manipulat", "toxic", "toxicity", "harassment", "threaten",
                       "radicali", "extremi", "propaganda"]),
    ("copyright",     ["copyright", "intellectual property", "plagiar"]),
    ("security",      ["hack", "exploit", "bypass", "breach", "jailbreak",
                       "adversarial", "mask", "spoof"]),
    ("autonomy",      ["automat", "autonomous", "self-driving", "driverless",
                       "without instruction", "unintended", "automatic termination"]),
    ("discrimination",["discriminat", "unfair", "inequit", "marginaliz"]),
]


def infer_harm_categories(title: str, description: str, harm_field: str) -> list[str]:
    """
    Infer harm taxonomy labels from free-text fields.

    Searches the title, description, and AIID harm field for keyword
    matches from _HARM_KEYWORD_MAP.  Falls back to ["other"] if nothing
    matches.  Always deduplicates and preserves insertion order.
    """
    haystack = " ".join([title, description, harm_field]).lower()
    found: list[str] = []

    for category, keywords in _HARM_KEYWORD_MAP:
        if any(kw in haystack for kw in keywords):
            if category not in found:
                found.append(category)

    return found if found else ["other"]


# ── Metadata field parser ──────────────────────────────────────────────────────

def parse_metadata_field(raw: str) -> dict[str, str]:
    """
    Parse the pipe-delimited AIID metadata string.

    Input:  "deployer: Uber || developer: Uber || harm: pedestrians || source: URL"
    Output: {"deployer": "Uber", "developer": "Uber",
             "harm": "pedestrians", "source": "URL"}
    """
    result: dict[str, str] = {}
    if not raw or not raw.strip():
        return result

    for segment in raw.split("||"):
        segment = segment.strip()
        if ":" in segment:
            key, _, value = segment.partition(":")
            result[key.strip().lower()] = value.strip()

    return result


def extract_companies(meta: dict[str, str]) -> list[str]:
    """
    Build a deduplicated list of company/org names from deployer + developer.

    Input metadata keys: "deployer", "developer"
    Splits on commas and normalises whitespace.
    """
    raw_companies: list[str] = []
    for key in ("deployer", "developer"):
        for part in meta.get(key, "").split(","):
            name = part.strip()
            if name and name.lower() not in ("unknown", ""):
                raw_companies.append(name)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for c in raw_companies:
        if c not in seen:
            seen.add(c)
            unique.append(c)
    return unique


def extract_aiid_id(external_id: str) -> Optional[str]:
    """
    Convert "Incident 23" → "AIID-23".  Returns None if no number found.
    """
    if not external_id:
        return None
    m = re.search(r"\d+", external_id)
    return f"AIID-{m.group()}" if m else None


def make_slug(csv_id: str, title: str) -> str:
    """
    Create a stable slug primary key: "aiid-{id}-{title-fragment}".

    Example: "aiid-4-uber-av-killed-pedestrian"
    """
    slug_title = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50]
    return f"aiid-{csv_id}-{slug_title}"


def parse_date(raw: str) -> Optional[datetime.date]:
    """
    Parse ISO-8601 date string.  Returns None if blank or unparseable.
    """
    raw = raw.strip()
    if not raw:
        return None
    try:
        return datetime.date.fromisoformat(raw[:10])
    except ValueError:
        return None


# ── Row → AIHarmIncident ───────────────────────────────────────────────────────

def row_to_incident(row: dict[str, str]) -> Optional[AIHarmIncident]:
    """
    Map one CSV row to an `AIHarmIncident`.

    Returns None if the row is missing required fields (date, title)
    so the caller can skip and log it.
    """
    title = row.get("title", "").strip()
    description = row.get("description", "").strip()
    published_date_raw = row.get("published_date", "").strip()
    csv_id = row.get("id", "").strip()

    if not title:
        return None

    date = parse_date(published_date_raw)
    if date is None:
        return None

    # ── Parse the pipe-delimited metadata field ──────────────────────────────
    meta = parse_metadata_field(row.get("metadata", ""))

    harm_field = meta.get("harm", "")
    companies = extract_companies(meta)

    # Prefer the metadata source URL; fall back to new_url column
    source_url = meta.get("source", "").strip() or row.get("new_url", "").strip()

    # Build links list (new_url first, then AIID source)
    links: list[str] = []
    new_url = row.get("new_url", "").strip()
    if new_url:
        links.append(new_url)
    if source_url and source_url not in links:
        links.append(source_url)

    # ── Harm taxonomy ────────────────────────────────────────────────────────
    harm_categories = infer_harm_categories(title, description, harm_field)

    # ── Image URL ────────────────────────────────────────────────────────────
    image_url: Optional[str] = row.get("image_url", "").strip() or None

    # ── AIID reference ───────────────────────────────────────────────────────
    aiid_id = extract_aiid_id(row.get("external_id", ""))

    # ── Affected population (harm field from AIID metadata) ──────────────────
    affected_population = harm_field if harm_field else "Unknown"

    return AIHarmIncident(
        id=make_slug(csv_id, title),
        date=date,
        title=title,
        description=description,
        source=f"AIID — {source_url}" if source_url else "AI Incident Database",
        links=links,
        tags=["aiid"] + harm_categories,
        countries=[],           # AIID export does not include country codes
        companies=companies,
        image_url=image_url,
        harm_categories=harm_categories,
        affected_population=affected_population,
        aiid_id=aiid_id,
        severity=None,          # AIID does not provide severity scores
    )


# ── CSV reader ────────────────────────────────────────────────────────────────

def load_csv(path: Path) -> list[dict[str, str]]:
    """Read the CSV and return a list of row dicts."""
    with path.open(encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        return list(reader)


# ── Parse ─────────────────────────────────────────────────────────────────────

def parse_all(
    rows: list[dict[str, str]],
    limit: Optional[int] = None,
) -> tuple[list[AIHarmIncident], list[tuple[int, str]]]:
    """
    Parse CSV rows into AIHarmIncident objects.

    Returns (incidents, skipped) where skipped is a list of
    (row_number, reason) tuples for rows that could not be parsed.
    """
    incidents: list[AIHarmIncident] = []
    skipped: list[tuple[int, str]] = []

    for i, row in enumerate(rows, start=2):  # row 1 is the header
        if limit is not None and len(incidents) >= limit:
            break
        try:
            inc = row_to_incident(row)
        except Exception as exc:
            skipped.append((i, f"Exception: {exc}"))
            continue

        if inc is None:
            reason = "missing date" if not row.get("published_date", "").strip() else "missing title"
            skipped.append((i, reason))
            continue

        incidents.append(inc)

    return incidents, skipped


# ── Output ────────────────────────────────────────────────────────────────────

def write_json(incidents: list[AIHarmIncident], path: Path) -> None:
    """Serialise incidents to a JSON fixtures file."""
    rows = [inc.to_db_row() for inc in incidents]
    path.write_text(
        json.dumps(rows, indent=2, ensure_ascii=False, default=str),
        encoding="utf-8",
    )
    print(f"  Wrote {len(rows)} incidents to {path}")


def upload_to_supabase(incidents: list[AIHarmIncident], batch_size: int = 50) -> None:
    """
    Upsert incidents into the Supabase `incidents` table in batches.

    Uses the service role key so RLS write policies are satisfied.
    Never expose this key in browser code.
    """
    try:
        from supabase import Client, create_client
    except ImportError:
        print("ERROR: supabase package not installed. Run: uv add supabase", file=sys.stderr)
        sys.exit(1)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print(
            "ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment "
            "or in a .env file in the data/ directory.",
            file=sys.stderr,
        )
        sys.exit(1)

    client: Client = create_client(url, key)
    rows = [inc.to_db_row() for inc in incidents]

    total = 0
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        result = client.table("incidents").upsert(batch, on_conflict="id").execute()

        if hasattr(result, "error") and result.error:
            print(f"ERROR uploading batch {start}–{start + len(batch)}: {result.error}", file=sys.stderr)
            sys.exit(1)

        total += len(batch)
        print(f"  Upserted {total}/{len(rows)} incidents…", end="\r")

    print(f"\n  Done — upserted {total} incidents into Supabase.")


# ── CLI entry point ───────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parse AIID CSV and import into the AI Incident Tracker."
    )
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help=f"Path to the AIID CSV file (default: {DEFAULT_CSV.name})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output JSON path (default: {DEFAULT_OUT.name})",
    )
    parser.add_argument(
        "--upload",
        action="store_true",
        help="Upsert parsed incidents into Supabase after writing JSON.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only import the first N rows (useful during development).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and validate rows but do not write any output.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Number of rows per Supabase upsert batch (default: 50).",
    )
    args = parser.parse_args()

    # ── Load CSV ──────────────────────────────────────────────────────────────
    if not args.csv.exists():
        print(f"ERROR: CSV file not found: {args.csv}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {args.csv} …")
    rows = load_csv(args.csv)
    print(f"  {len(rows)} rows read.")

    # ── Parse ─────────────────────────────────────────────────────────────────
    print("Parsing rows…")
    incidents, skipped = parse_all(rows, limit=args.limit)

    print(f"  OK  {len(incidents)} incidents parsed successfully.")
    if skipped:
        print(f"  SKIP {len(skipped)} rows skipped:")
        for row_num, reason in skipped[:20]:
            print(f"      Row {row_num}: {reason}")
        if len(skipped) > 20:
            print(f"      … and {len(skipped) - 20} more.")

    # ── Summary ───────────────────────────────────────────────────────────────
    from collections import Counter
    cat_counts = Counter(
        cat
        for inc in incidents
        for cat in inc.harm_categories
    )
    print("\nHarm category breakdown:")
    for cat, count in cat_counts.most_common():
        print(f"  {cat:<25} {count}")

    if args.dry_run:
        print("\n--dry-run: no output written.")
        return

    # ── Write JSON ────────────────────────────────────────────────────────────
    print(f"\nWriting JSON…")
    write_json(incidents, args.out)

    # ── Upload ────────────────────────────────────────────────────────────────
    if args.upload:
        print(f"\nUploading to Supabase (batch size: {args.batch_size})…")
        upload_to_supabase(incidents, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
