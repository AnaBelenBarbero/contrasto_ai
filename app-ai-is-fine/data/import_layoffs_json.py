"""
AI Incident Tracker — layoffs.json importer.

Parses the layoffs JSON file and maps every report to an `AILayoffEvent`.

Usage:
    uv run python import_layoffs_json.py                       # write layoffs_incidents.json
    uv run python import_layoffs_json.py --upload              # also upsert to Supabase
    uv run python import_layoffs_json.py --json path/to/file   # custom input
    uv run python import_layoffs_json.py --dry-run             # validate only

JSON fields used:
    id              Numeric → slug "layoff-{id}"
    date            ISO-8601 date string
    company         Company name → companies list
    industry        Sector string
    country         Full country name → countries list
    jobsLost        Headcount reduction
    aiAttribution   "EXPLICIT" | "MIXED" | "INDIRECT" → ai_automation_confirmed
    imageUrl        Image URL
    sourceLabel     Link label
    sourceUrl       Primary source URL
    estimate        Whether the figure is an estimate (stored in description)
    jobsLostToBeConfirmed True when the jobs_lost figure has not yet been formally agreed with unions or confirmed by the company — e.g. an ERE announced but still under negotiation. False means the figure is confirmed.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv

from models import AILayoffEvent

load_dotenv()

DEFAULT_JSON = Path(__file__).parent / "layoffs.json"
DEFAULT_OUT = Path(__file__).parent / "layoffs_incidents.json"


def make_slug(report_id: int) -> str:
    """Stable primary key for upserts."""
    return f"layoff-{report_id}"


def make_description(r: dict) -> str:
    """Build a human-readable description from available fields."""
    jobs = r.get("jobsLost", 0)
    company = r["company"]
    tbc = r.get("jobsLostToBeConfirmed", False)
    jobs_phrase = "an undisclosed number of" if tbc and not jobs else f"{jobs:,}"
    estimate_note = " (estimated)" if r.get("estimate") and not tbc else ""
    tbc_note = " (count to be confirmed)" if tbc else ""
    attribution = r.get("aiAttribution", "")
    attribution_phrases = {
        "EXPLICIT": "explicitly attributed to AI/automation",
        "MIXED": "partially attributed to AI/automation",
        "INDIRECT": "indirectly linked to AI investment or restructuring",
    }
    attr_note = attribution_phrases.get(attribution, "linked to AI")
    workforce = r.get("workforce")
    pct = f" ({round(jobs / workforce * 100)}% of workforce)" if workforce and workforce > 0 and jobs > 0 else ""
    return f"{company} cut {jobs_phrase} jobs{pct}{estimate_note}{tbc_note}, {attr_note}."


def row_to_incident(r: dict) -> AILayoffEvent | None:
    """Map one JSON report dict to an AILayoffEvent. Returns None if data is unusable."""
    try:
        date = datetime.date.fromisoformat(r["date"][:10])
    except (KeyError, ValueError):
        return None

    jobs_lost = r.get("jobsLost", 0)
    tbc = r.get("jobsLostToBeConfirmed", False)

    # Skip rows with no job count unless the count is explicitly flagged as TBC.
    if not tbc and (not jobs_lost or jobs_lost < 1):
        return None

    source_url = r.get("sourceUrl", "")
    source_label = r.get("sourceLabel", "Source")
    jobs_label = "an undisclosed number of" if tbc and not jobs_lost else f"{jobs_lost:,}"

    return AILayoffEvent(
        id=make_slug(r["id"]),
        date=date,
        title=f"{r['company']} lays off {jobs_label} workers",
        description=make_description(r),
        source=f"{source_label} — {source_url}" if source_url else source_label,
        links=[source_url] if source_url else [],
        tags=["layoff", r.get("industry", "").lower().replace(" ", "-")],
        countries=[r["country"]] if r.get("country") else [],
        companies=[r["company"]],
        image_url=r.get("imageUrl", None),
        sector=r.get("industry", "Unknown"),
        jobs_lost=jobs_lost,
        ai_automation_confirmed=r.get("aiAttribution") == "EXPLICIT",
        severity=None,
        jobs_lost_to_be_confirmed=tbc or None,
    )


def upload_to_supabase(incidents: list[AILayoffEvent], batch_size: int = 50) -> None:
    """Upsert incidents into Supabase using the service role key."""
    try:
        from supabase import Client, create_client
    except ImportError:
        print("ERROR: supabase not installed. Run: uv add supabase", file=sys.stderr)
        sys.exit(1)

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    client: Client = create_client(url, key)
    rows = [inc.to_db_row() for inc in incidents]

    total = 0
    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        result = client.table("incidents").upsert(batch, on_conflict="id").execute()
        if hasattr(result, "error") and result.error:
            print(f"ERROR in batch {start}: {result.error}", file=sys.stderr)
            sys.exit(1)
        total += len(batch)
        print(f"  Upserted {total}/{len(rows)}...", end="\r")

    print(f"\n  Done — upserted {total} incidents into Supabase.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import layoffs.json into AI Incident Tracker.")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--upload", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--batch-size", type=int, default=50)
    args = parser.parse_args()

    data = json.loads(args.json.read_text(encoding="utf-8"))
    reports = data.get("reports", data) if isinstance(data, dict) else data

    incidents, skipped = [], []
    for r in reports:
        inc = row_to_incident(r)
        if inc:
            incidents.append(inc)
        else:
            skipped.append(r.get("id", "?"))

    print(f"Parsed {len(incidents)} layoff events. Skipped: {len(skipped)} ({skipped[:10]})")

    total_jobs = sum(i.jobs_lost for i in incidents if not i.jobs_lost_to_be_confirmed)
    tbc_count = sum(1 for i in incidents if i.jobs_lost_to_be_confirmed)
    explicit = sum(1 for i in incidents if i.ai_automation_confirmed)
    tbc_note = f" + {tbc_count} TBC" if tbc_count else ""
    print(f"Total jobs lost: {total_jobs:,}{tbc_note} | Explicitly AI-attributed: {explicit}/{len(incidents)}")

    if args.dry_run:
        print("--dry-run: no output written.")
        return

    rows = [inc.to_db_row() for inc in incidents]
    args.out.write_text(json.dumps(rows, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"Wrote {len(rows)} incidents to {args.out}")

    if args.upload:
        upload_to_supabase(incidents, batch_size=args.batch_size)


if __name__ == "__main__":
    main()
