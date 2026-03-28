from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import requests

KEV_JSON_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"


@dataclass(frozen=True)
class KevEntry:
    cve_id: str
    vendor_project: str
    product: str
    vulnerability_name: str
    date_added: Optional[str]
    short_description: str
    known_ransomware_use: Optional[str]
    due_date: Optional[str]


def fetch_kev_catalog(timeout: int = 20) -> list[KevEntry]:
    try:
        response = requests.get(
            KEV_JSON_URL,
            headers={"Accept": "application/json"},
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError):
        return []

    vulns = payload.get("vulnerabilities", []) or []
    out: list[KevEntry] = []

    for item in vulns:
        cve_id = str(item.get("cveID", "")).strip().upper()
        if not cve_id.startswith("CVE-"):
            continue

        out.append(
            KevEntry(
                cve_id=cve_id,
                vendor_project=str(item.get("vendorProject", "")).strip(),
                product=str(item.get("product", "")).strip(),
                vulnerability_name=str(item.get("vulnerabilityName", "")).strip(),
                date_added=item.get("dateAdded"),
                short_description=str(item.get("shortDescription", "")).strip(),
                known_ransomware_use=item.get("knownRansomwareCampaignUse"),
                due_date=item.get("dueDate"),
            )
        )

    return out


def fetch_kev_cve_set(timeout: int = 20) -> set[str]:
    return {entry.cve_id for entry in fetch_kev_catalog(timeout=timeout)}


def is_cve_in_kev(cve_id: str, kev_cves: set[str]) -> bool:
    norm = (cve_id or "").strip().upper()
    return norm in kev_cves
