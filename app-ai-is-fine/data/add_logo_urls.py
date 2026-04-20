"""
Patches layoffs.json with a curated imageUrl for every company entry.

Uses logo.wine (same source as Capgemini) and Wikimedia Commons as fallbacks.
Clears API dependency entirely — all URLs are static and public.

Usage:
    uv run python add_logo_urls.py
"""

import json
from pathlib import Path

# ---------------------------------------------------------------------------
# Curated logo URL map — keyed by company name as it appears in layoffs.json.
# Prefer logo.wine for consistency with Capgemini; fall back to Wikimedia.
# ---------------------------------------------------------------------------
LOGO_URLS: dict[str, str] = {
    "Snapchat": "https://brandemia.org/contenido/subidas/2019/07/snapchat-nuevo-logo-1200x670.png",
    "Capgemini": "https://download.logo.wine/logo/Capgemini/Capgemini-Logo.wine.png",
    "Meta": "https://download.logo.wine/logo/Meta_Platforms/Meta_Platforms-Logo.wine.png",
    "Oracle": "https://download.logo.wine/logo/Oracle_Corporation/Oracle_Corporation-Logo.wine.png",
    "Dell Technologies": "https://download.logo.wine/logo/Dell_Technologies/Dell_Technologies-Logo.wine.png",
    "Crypto.com": "https://logos-world.net/wp-content/uploads/2024/12/Crypto.Com-Logo.jpg",
    "Atlassian": "https://download.logo.wine/logo/Atlassian/Atlassian-Logo.wine.png",
    "Amazon": "https://download.logo.wine/logo/Amazon_(company)/Amazon_(company)-Logo.wine.png",
    "Morgan Stanley": "https://download.logo.wine/logo/Morgan_Stanley/Morgan_Stanley-Logo.wine.png",
    "eBay": "https://download.logo.wine/logo/EBay/EBay-Logo.wine.png",
    "Block": "https://upload.wikimedia.org/wikipedia/ru/3/33/Block%2C_Inc_logo.png",
    "WiseTech": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT25mDdLy3EUmoPZAw-1hJUHLpfDPlOuoX8ZQ&s",
    "Baker McKenzie": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQx9kR_FwDmX0dqYXkZN91bsmAIUhzMw-kufg&s",
    "Autodesk": "https://download.logo.wine/logo/Autodesk/Autodesk-Logo.wine.png",
    "Livspace": "https://www.bvp.com/assets/uploads/2022/12/portfolio-livspace.png",
    "Expedia": "https://download.logo.wine/logo/Expedia_Group/Expedia_Group-Logo.wine.png",
    "Dow": "https://download.logo.wine/logo/Dow_Inc./Dow_Inc.-Logo.wine.png",
    "Chan Zuckerberg Initiative": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/be/Chan_Zuckerberg_Initiative_logo.svg/1200px-Chan_Zuckerberg_Initiative_logo.svg.png",
    "ASML": "https://download.logo.wine/logo/ASML/ASML-Logo.wine.png",
    "Pinterest": "https://download.logo.wine/logo/Pinterest/Pinterest-Logo.wine.png",
    "Chegg": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Chegg_logo.svg/960px-Chegg_logo.svg.png",
    "Accenture": "https://download.logo.wine/logo/Accenture/Accenture-Logo.wine.png",
    "Salesforce": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Salesforce.com_logo.svg/960px-Salesforce.com_logo.svg.png",
    "Scale AI": "https://upload.wikimedia.org/wikipedia/commons/7/74/Scale_AI.svg",
    "Microsoft": "https://download.logo.wine/logo/Microsoft/Microsoft-Logo.wine.png",
    "CrowdStrike": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/CrowdStrike_logo.svg/3840px-CrowdStrike_logo.svg.png",
    "Workday": "https://download.logo.wine/logo/Workday/Workday-Logo.wine.png",
}


def patch_logos(json_path: Path) -> None:
    """Inject imageUrl into every report entry that lacks one."""
    data: dict = json.loads(json_path.read_text(encoding="utf-8"))

    missing: list[str] = []
    for report in data["reports"]:
        company: str = report["company"]
        url: str | None = LOGO_URLS.get(company)
        if url:
            report["imageUrl"] = url
        elif "imageUrl" not in report:
            missing.append(company)

    json_path.write_text(
        json.dumps(data, indent=4, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"Patched {json_path.name} — {len(data['reports'])} reports.")
    if missing:
        print(f"WARNING: no logo URL for: {', '.join(sorted(set(missing)))}")
    else:
        print("All companies have an imageUrl.")


if __name__ == "__main__":
    target = Path(__file__).parent / "layoffs.json"
    patch_logos(target)
