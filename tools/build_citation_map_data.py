#!/usr/bin/env python3
"""Build public aggregate citation-map data from OpenAlex metadata."""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path


AUTHOR_ID = "A5085084417"
AUTHOR_FULL_ID = f"https://openalex.org/{AUTHOR_ID}"
CONTACT_EMAIL = "saitiku@gmail.com"
BASE = "https://api.openalex.org"
ROOT = Path(__file__).resolve().parents[1]
INTERNAL_DIR = ROOT / ".internal"
PUBLIC_DATA_PATH = ROOT / "assets" / "citation-map-data.js"
INTERNAL_RECORD_PATH = INTERNAL_DIR / "citation-affiliations.json"


def fetch_json(path: str, params: dict[str, str | int] | None = None) -> dict:
    query = {"mailto": CONTACT_EMAIL}
    if params:
        query.update(params)

    url = f"{BASE}{path}?{urllib.parse.urlencode(query, safe=':,|')}"
    with urllib.request.urlopen(url, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_all(path: str, params: dict[str, str | int]) -> list[dict]:
    results: list[dict] = []
    page = 1
    while True:
        payload = fetch_json(path, {**params, "page": page})
        page_results = payload.get("results", [])
        results.extend(page_results)
        if len(page_results) < int(params.get("per-page", 200)):
            break
        page += 1
        time.sleep(0.12)
    return results


def compact_id(openalex_id: str) -> str:
    return openalex_id.rsplit("/", 1)[-1]


def main() -> None:
    INTERNAL_DIR.mkdir(exist_ok=True)

    author_payload = fetch_json(f"/authors/{AUTHOR_ID}")
    author_works = fetch_all(
        "/works",
        {
            "filter": f"authorships.author.id:{AUTHOR_ID}",
            "per-page": 200,
            "select": "id,title,publication_year,doi,cited_by_count",
            "sort": "publication_year:desc",
        },
    )

    cited_works = [work for work in author_works if work.get("cited_by_count", 0) > 0]
    citing_records: dict[str, dict] = {}
    self_citing_ids: set[str] = set()

    for index, work in enumerate(cited_works, start=1):
        cited_work_id = compact_id(work["id"])
        citation_filter = f"cites:{cited_work_id}"
        citing_works = fetch_all(
            "/works",
            {
                "filter": citation_filter,
                "per-page": 200,
                "select": "id,title,publication_year,doi,authorships",
            },
        )

        self_citations = 0
        for citing_work in citing_works:
            # Skip self-citations: works where this author is also an author.
            author_ids_in_citing = {
                authorship.get("author", {}).get("id")
                for authorship in citing_work.get("authorships", [])
            }
            if AUTHOR_FULL_ID in author_ids_in_citing:
                self_citing_ids.add(citing_work["id"])
                self_citations += 1
                continue

            citing_id = citing_work["id"]
            record = citing_records.setdefault(
                citing_id,
                {
                    "id": citing_id,
                    "title": citing_work.get("title"),
                    "year": citing_work.get("publication_year"),
                    "doi": citing_work.get("doi"),
                    "cites": [],
                    "institution_ids": set(),
                },
            )
            record["cites"].append(
                {
                    "id": work["id"],
                    "title": work.get("title"),
                    "year": work.get("publication_year"),
                }
            )
            for authorship in citing_work.get("authorships", []):
                for institution in authorship.get("institutions", []):
                    institution_id = institution.get("id")
                    if institution_id:
                        record["institution_ids"].add(institution_id)

        print(
            f"{index:02d}/{len(cited_works)} {cited_work_id}: "
            f"{len(citing_works)} citing works ({self_citations} self-citations excluded)"
        )
        time.sleep(0.2)

    # Compute h-index and i10-index from non-self-citation counts per author work.
    work_nsc_counts: Counter[str] = Counter()
    for record in citing_records.values():
        for cited_ref in record["cites"]:
            work_nsc_counts[cited_ref["id"]] += 1

    nsc_sorted = sorted(work_nsc_counts.values(), reverse=True)
    h_index = sum(1 for i, c in enumerate(nsc_sorted, 1) if c >= i)
    i10_index = sum(1 for c in work_nsc_counts.values() if c >= 10)

    institution_ids = sorted(
        {
            institution_id
            for record in citing_records.values()
            for institution_id in record["institution_ids"]
        }
    )

    institutions: dict[str, dict] = {}
    for start in range(0, len(institution_ids), 50):
        chunk = institution_ids[start : start + 50]
        filter_ids = "|".join(compact_id(institution_id) for institution_id in chunk)
        for institution in fetch_all(
            "/institutions",
            {
                "filter": f"openalex_id:{filter_ids}",
                "per-page": 50,
                "select": "id,display_name,country_code,geo,type",
            },
        ):
            institutions[institution["id"]] = institution
        time.sleep(0.15)

    institution_counts: Counter[str] = Counter()
    country_counts: Counter[str] = Counter()
    country_names: dict[str, str] = {}
    internal_records: list[dict] = []

    for record in citing_records.values():
        institution_ids_for_work = sorted(record["institution_ids"])
        for institution_id in institution_ids_for_work:
            institution = institutions.get(institution_id)
            if not institution:
                continue
            geo = institution.get("geo") or {}
            if geo.get("latitude") is None or geo.get("longitude") is None:
                continue
            institution_counts[institution_id] += 1
            country_code = geo.get("country_code") or institution.get("country_code")
            if country_code:
                country_counts[country_code] += 1
                country_names[country_code] = geo.get("country") or country_code

        internal_records.append(
            {
                "id": record["id"],
                "title": record["title"],
                "year": record["year"],
                "doi": record["doi"],
                "cites": record["cites"],
                "institutions": [
                    {
                        "id": institution_id,
                        "name": institutions.get(institution_id, {}).get("display_name"),
                        "geo": institutions.get(institution_id, {}).get("geo"),
                    }
                    for institution_id in institution_ids_for_work
                ],
            }
        )

    points = []
    for institution_id, count in institution_counts.most_common():
        institution = institutions[institution_id]
        geo = institution["geo"]
        points.append(
            {
                "name": institution["display_name"],
                "city": geo.get("city"),
                "region": geo.get("region"),
                "country": geo.get("country"),
                "countryCode": geo.get("country_code") or institution.get("country_code"),
                "lat": geo["latitude"],
                "lon": geo["longitude"],
                "citingWorks": count,
            }
        )

    public_data = {
        "generated": date.today().isoformat(),
        "source": "OpenAlex",
        "author": {
            "id": author_payload.get("id"),
            "name": author_payload.get("display_name"),
            "orcid": author_payload.get("orcid"),
        },
        "summary": {
            "hIndex": h_index,
            "i10Index": i10_index,
            "selfCitingWorksExcluded": len(self_citing_ids),
            "authorWorksInOpenAlex": len(author_works),
            "citedAuthorWorksInOpenAlex": len(cited_works),
            "uniqueCitingWorks": len(citing_records),
            "citingWorksWithMappedInstitutions": sum(
                1
                for record in citing_records.values()
                if any(institution_id in institution_counts for institution_id in record["institution_ids"])
            ),
            "mappedInstitutions": len(points),
            "mappedCountries": len(country_counts),
            "institutionMentions": sum(institution_counts.values()),
        },
        "topCountries": [
            {
                "code": code,
                "name": country_names.get(code, code),
                "affiliationMentions": count,
            }
            for code, count in country_counts.most_common(8)
        ],
        "points": points,
    }

    internal_payload = {
        "generated": public_data["generated"],
        "source": "OpenAlex",
        "author": public_data["author"],
        "summary": public_data["summary"],
        "citingRecords": internal_records,
    }

    INTERNAL_RECORD_PATH.write_text(json.dumps(internal_payload, indent=2, sort_keys=True), encoding="utf-8")
    PUBLIC_DATA_PATH.write_text(
        "window.citationMapData = "
        + json.dumps(public_data, indent=2, sort_keys=True)
        + ";\n",
        encoding="utf-8",
    )

    print(json.dumps(public_data["summary"], indent=2))
    print(f"Wrote {PUBLIC_DATA_PATH.relative_to(ROOT)}")
    print(f"Wrote {INTERNAL_RECORD_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
