from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests

NVD_BASE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"


@dataclass(frozen=True)
class NvdCveItem:
    cve_id: str
    description: str
    cvss: Optional[float]
    published: Optional[str]
    last_modified: Optional[str]
    url: str


def _pick_english_description(cve_obj: Dict[str, Any]) -> str:
    descs = cve_obj.get("descriptions", []) or []
    for d in descs:
        if d.get("lang") == "en" and d.get("value"):
            return d["value"]
    # fallback
    if descs and isinstance(descs[0], dict):
        return descs[0].get("value", "") or ""
    return ""


def _extract_cvss_base_score(cve_obj: Dict[str, Any]) -> Optional[float]:
    """
    NVD may include v3.1/v3.0/v4 metrics. We'll prefer v3.1 if present.
    Structure can vary; this function is defensive.
    """
    metrics = cve_obj.get("metrics", {}) or {}

    # Try CVSS v3.1
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV40", "cvssMetricV3", "cvssMetricV2"):
        arr = metrics.get(key)
        if isinstance(arr, list) and arr:
            first = arr[0] or {}
            data = first.get("cvssData", {}) or {}
            score = data.get("baseScore")
            if isinstance(score, (int, float)):
                return float(score)

    return None


def search_cves(keyword: str, api_key: Optional[str], limit: int = 20) -> List[NvdCveItem]:
    """
    Keyword search uses the NVD parameter `keywordSearch` (documented in NVD workflows/docs).
    """
    keyword = (keyword or "").strip()
    if not keyword:
        return []

    params = {
        "keywordSearch": keyword,
        "resultsPerPage": min(max(limit, 1), 2000),
        "startIndex": 0,
        "noRejected": "",  # exclude REJECTed when supported as valueless flag
    }

    headers = {}
    if api_key:
        headers["apiKey"] = api_key  # NVD expects API key in header :contentReference[oaicite:3]{index=3}

    r = requests.get(NVD_BASE_URL, params=params, headers=headers, timeout=20)
    r.raise_for_status()
    data = r.json()

    items: List[NvdCveItem] = []
    for v in data.get("vulnerabilities", []) or []:
        cve = (v or {}).get("cve", {}) or {}
        cve_id = cve.get("id") or ""
        if not cve_id:
            continue

        desc = _pick_english_description(cve)
        cvss = _extract_cvss_base_score(cve)
        published = cve.get("published")
        last_modified = cve.get("lastModified")

        items.append(
            NvdCveItem(
                cve_id=cve_id,
                description=desc,
                cvss=cvss,
                published=published,
                last_modified=last_modified,
                url=f"https://nvd.nist.gov/vuln/detail/{cve_id}",
            )
        )

    return items


def get_cve_by_id(cve_id: str, api_key: Optional[str]) -> Optional[NvdCveItem]:
    cve_id = (cve_id or "").strip().upper()
    if not cve_id.startswith("CVE-"):
        return None

    params = {"cveId": cve_id}
    headers = {}
    if api_key:
        headers["apiKey"] = api_key  # :contentReference[oaicite:4]{index=4}

    r = requests.get(NVD_BASE_URL, params=params, headers=headers, timeout=20)
    r.raise_for_status()
    data = r.json()

    vulns = data.get("vulnerabilities", []) or []
    if not vulns:
        return None

    cve = (vulns[0] or {}).get("cve", {}) or {}
    desc = _pick_english_description(cve)
    cvss = _extract_cvss_base_score(cve)

    return NvdCveItem(
        cve_id=cve_id,
        description=desc,
        cvss=cvss,
        published=cve.get("published"),
        last_modified=cve.get("lastModified"),
        url=f"https://nvd.nist.gov/vuln/detail/{cve_id}",
    )