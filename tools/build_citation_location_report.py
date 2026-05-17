#!/usr/bin/env python3
"""Build a Markdown report of citing works grouped by affiliation location."""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path
from typing import Any


CONTACT_EMAIL = "saitiku@gmail.com"
BASE = "https://api.openalex.org"
ROOT = Path(__file__).resolve().parents[1]
INTERNAL_RECORD_PATH = ROOT / ".internal" / "citation-affiliations.json"
CACHE_PATH = ROOT / ".internal" / "openalex-citing-work-details.json"
DEFAULT_OUTPUT_PATH = ROOT / "citation-location-report.md"


def fetch_json(path: str, params: dict[str, str | int]) -> dict[str, Any]:
    query = {"mailto": CONTACT_EMAIL}
    query.update(params)
    url = f"{BASE}{path}?{urllib.parse.urlencode(query, safe=':,|')}"
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_all(path: str, params: dict[str, str | int]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    page = 1
    per_page = int(params.get("per-page", 200))
    while True:
        payload = fetch_json(path, {**params, "page": page})
        page_results = payload.get("results", [])
        results.extend(page_results)
        if len(page_results) < per_page:
            break
        page += 1
        time.sleep(0.12)
    return results


def compact_id(openalex_id: str) -> str:
    return openalex_id.rsplit("/", 1)[-1]


def clean_text(value: Any) -> str:
    return " ".join(str(value or "").split())


def format_place(geo: dict[str, Any] | None) -> str:
    if not geo:
        return ""
    return ", ".join(
        clean_text(part)
        for part in (geo.get("city"), geo.get("region"), geo.get("country"))
        if clean_text(part)
    )


def format_institution(institution: dict[str, Any]) -> str:
    name = clean_text(institution.get("name") or institution.get("display_name"))
    place = format_place(institution.get("geo"))
    return f"{name}, {place}" if place else name


def normalize_title(title: str) -> str:
    return "".join(ch.lower() if ch.isalnum() else " " for ch in title).strip()


def unique_cites(cites: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[str, int | None]] = set()
    deduped: list[dict[str, Any]] = []
    for cited in cites:
        title = clean_text(cited.get("title"))
        key = (normalize_title(title), cited.get("year"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(cited)
    return deduped


def author_name(authorship: dict[str, Any]) -> str:
    author = authorship.get("author") or {}
    return clean_text(author.get("display_name") or authorship.get("raw_author_name") or "Unknown author")


def build_institution_lookup(records: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    institutions: dict[str, dict[str, Any]] = {}
    for record in records:
        for institution in record.get("institutions", []):
            institution_id = institution.get("id")
            if institution_id:
                institutions[institution_id] = institution
    return institutions


def load_work_cache(refresh: bool) -> dict[str, dict[str, Any]]:
    if refresh or not CACHE_PATH.exists():
        return {}
    with CACHE_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    return payload.get("works", {})


def save_work_cache(works: dict[str, dict[str, Any]]) -> None:
    CACHE_PATH.parent.mkdir(exist_ok=True)
    payload = {
        "generated": date.today().isoformat(),
        "source": "OpenAlex",
        "works": works,
    }
    CACHE_PATH.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")


def fetch_work_details(records: list[dict[str, Any]], refresh: bool) -> dict[str, dict[str, Any]]:
    works = load_work_cache(refresh)
    missing = [record["id"] for record in records if record["id"] not in works]
    if not missing:
        return works

    for start in range(0, len(missing), 25):
        chunk = missing[start : start + 25]
        filter_ids = "|".join(compact_id(work_id) for work_id in chunk)
        for work in fetch_all(
            "/works",
            {
                "filter": f"openalex_id:{filter_ids}",
                "per-page": 25,
                "select": "id,title,publication_year,doi,authorships",
            },
        ):
            works[work["id"]] = work
        print(f"Fetched OpenAlex authorship metadata for {min(start + 25, len(missing))}/{len(missing)} works")
        time.sleep(0.15)

    save_work_cache(works)
    return works


def author_records(
    work: dict[str, Any] | None,
    institution_lookup: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    authors: list[dict[str, Any]] = []
    if not work:
        return authors

    for authorship in work.get("authorships", []):
        institutions = []
        for institution in authorship.get("institutions", []):
            institution_id = institution.get("id")
            known = institution_lookup.get(institution_id, {}) if institution_id else {}
            institutions.append(
                {
                    "id": institution_id,
                    "name": clean_text(known.get("name") or institution.get("display_name")),
                    "geo": known.get("geo"),
                }
            )
        authors.append(
            {
                "name": author_name(authorship),
                "institutions": institutions,
                "raw_affiliations": [clean_text(item) for item in authorship.get("raw_affiliation_strings", [])],
                "countries": authorship.get("countries", []),
            }
        )
    return authors


def format_author_association(author: dict[str, Any]) -> str:
    if author["institutions"]:
        affiliations = "; ".join(
            format_institution(institution)
            for institution in author["institutions"]
            if clean_text(institution.get("name"))
        )
        if affiliations:
            return f"{author['name']} ({affiliations})"

    if author["raw_affiliations"]:
        return f"{author['name']} ({'; '.join(author['raw_affiliations'][:2])})"

    if author["countries"]:
        return f"{author['name']} ({', '.join(author['countries'])})"

    return f"{author['name']} (affiliation not available in OpenAlex)"


def format_cited_papers(cites: list[dict[str, Any]]) -> str:
    parts = []
    for cited in unique_cites(cites):
        year = cited.get("year")
        suffix = f" ({year})" if year else ""
        parts.append(f"{clean_text(cited.get('title'))}{suffix}")
    return "; ".join(parts) if parts else "Not available"


def entry_for_record(
    record: dict[str, Any],
    works: dict[str, dict[str, Any]],
    institution_lookup: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    work = works.get(record["id"])
    title = clean_text((work or {}).get("title") or record.get("title"))
    year = (work or {}).get("publication_year") or record.get("year")
    doi = clean_text((work or {}).get("doi") or record.get("doi"))
    authors = author_records(work, institution_lookup)

    return {
        "id": record["id"],
        "title": title,
        "year": year,
        "doi": doi,
        "authors": authors,
        "author_associations": "; ".join(format_author_association(author) for author in authors)
        or "Author metadata not available in OpenAlex",
        "cited_papers": format_cited_papers(record.get("cites", [])),
        "institutions": record.get("institutions", []),
    }


def authors_at_institution(entry: dict[str, Any], institution_id: str) -> str:
    names = []
    seen = set()
    for author in entry["authors"]:
        if any(institution.get("id") == institution_id for institution in author["institutions"]):
            if author["name"] not in seen:
                seen.add(author["name"])
                names.append(author["name"])
    return "; ".join(names) if names else "Author-level association not available in OpenAlex"


def work_sort_key(entry: dict[str, Any]) -> tuple[int, str]:
    return (-(entry.get("year") or 0), entry["title"].casefold())


def build_groups(
    records: list[dict[str, Any]],
    works: dict[str, dict[str, Any]],
    institution_lookup: dict[str, dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], dict[str, dict[str, Any]]]:
    groups: dict[str, dict[str, Any]] = {}
    unmapped: list[dict[str, Any]] = []
    entries_by_id: dict[str, dict[str, Any]] = {}

    for record in records:
        entry = entry_for_record(record, works, institution_lookup)
        entries_by_id[entry["id"]] = entry
        mapped_ids = []

        for institution in entry["institutions"]:
            institution_id = institution.get("id")
            geo = institution.get("geo") or {}
            if not institution_id or geo.get("latitude") is None or geo.get("longitude") is None:
                continue
            mapped_ids.append(institution_id)
            country = clean_text(geo.get("country") or geo.get("country_code") or "Unknown country")
            group = groups.setdefault(
                institution_id,
                {
                    "institution": institution,
                    "country": country,
                    "city": clean_text(geo.get("city")),
                    "region": clean_text(geo.get("region")),
                    "entries": [],
                },
            )
            group["entries"].append(entry)

        if not mapped_ids:
            unmapped.append(entry)

    return groups, unmapped, entries_by_id


def group_sort_key(group: dict[str, Any]) -> tuple[str, str, str, str]:
    return (
        group["country"].casefold(),
        group["city"].casefold(),
        group["region"].casefold(),
        clean_text(group["institution"].get("name")).casefold(),
    )


def write_report(
    output_path: Path,
    source_payload: dict[str, Any],
    groups: dict[str, dict[str, Any]],
    unmapped: list[dict[str, Any]],
    entries_by_id: dict[str, dict[str, Any]],
) -> None:
    lines: list[str] = []
    summary = source_payload.get("summary", {})
    country_count = len({group["country"] for group in groups.values()})

    lines.extend(
        [
            "# Citation Location Report",
            "",
            f"Generated: {date.today().isoformat()}",
            "",
            "Source: OpenAlex metadata, enriched from `.internal/citation-affiliations.json`.",
            "",
            "Notes:",
            "",
            "- The source citation dataset excludes OpenAlex self-citation matches to Saideep Tiku.",
            "- A citing paper can appear under more than one location when its authors have affiliations in multiple places.",
            "- `Authors at this location` lists authors connected to the heading institution. `Authors and associations` lists all authors and their OpenAlex affiliations for that citing paper.",
            "- `Cites my paper(s)` lists Saideep Tiku works cited by the citing paper, deduplicated by title and year.",
            "",
            "Summary:",
            "",
            f"- Unique citing works in source: {len(entries_by_id)}",
            f"- Citing works with mapped institutions: {summary.get('citingWorksWithMappedInstitutions', 'unknown')}",
            f"- Mapped institution locations in this report: {len(groups)}",
            f"- Countries represented: {country_count}",
            f"- Unmapped citing works: {len(unmapped)}",
            "",
        ]
    )

    groups_by_country: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for group in groups.values():
        groups_by_country[group["country"]].append(group)

    for country in sorted(groups_by_country, key=str.casefold):
        lines.extend([f"## {country}", ""])
        for group in sorted(groups_by_country[country], key=group_sort_key):
            institution = group["institution"]
            place = ", ".join(part for part in (group["city"], group["region"], group["country"]) if part)
            location_title = clean_text(institution.get("name"))
            if place:
                location_title = f"{location_title} - {place}"
            unique_entries = {entry["id"]: entry for entry in group["entries"]}
            lines.extend([f"### {location_title}", ""])

            for entry in sorted(unique_entries.values(), key=work_sort_key):
                year = f" ({entry['year']})" if entry.get("year") else ""
                lines.append(f"- **{entry['title']}**{year}")
                if entry.get("doi"):
                    lines.append(f"  - DOI: <{entry['doi']}>")
                lines.append(f"  - OpenAlex: <{entry['id']}>")
                lines.append(f"  - Authors at this location: {authors_at_institution(entry, institution['id'])}")
                lines.append(f"  - Authors and associations: {entry['author_associations']}")
                lines.append(f"  - Cites my paper(s): {entry['cited_papers']}")
            lines.append("")

    if unmapped:
        lines.extend(["## Unmapped Or No Structured Location", ""])
        for entry in sorted(unmapped, key=work_sort_key):
            year = f" ({entry['year']})" if entry.get("year") else ""
            lines.append(f"- **{entry['title']}**{year}")
            if entry.get("doi"):
                lines.append(f"  - DOI: <{entry['doi']}>")
            lines.append(f"  - OpenAlex: <{entry['id']}>")
            lines.append(f"  - Authors and associations: {entry['author_associations']}")
            lines.append(f"  - Cites my paper(s): {entry['cited_papers']}")
        lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT_PATH,
        help=f"Markdown output path. Default: {DEFAULT_OUTPUT_PATH}",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Ignore cached OpenAlex work details and refetch authorship metadata.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not INTERNAL_RECORD_PATH.exists():
        raise SystemExit(
            f"Missing {INTERNAL_RECORD_PATH}. Run tools/build_citation_map_data.py first."
        )

    with INTERNAL_RECORD_PATH.open(encoding="utf-8") as handle:
        source_payload = json.load(handle)

    records = source_payload.get("citingRecords", [])
    institution_lookup = build_institution_lookup(records)
    works = fetch_work_details(records, args.refresh)
    groups, unmapped, entries_by_id = build_groups(records, works, institution_lookup)
    write_report(args.output, source_payload, groups, unmapped, entries_by_id)

    print(f"Wrote {args.output}")
    print(f"Grouped {len(entries_by_id)} citing works across {len(groups)} mapped institution locations")


if __name__ == "__main__":
    main()
