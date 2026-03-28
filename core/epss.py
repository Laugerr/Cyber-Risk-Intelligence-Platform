from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import requests

EPSS_API_URL = "https://api.first.org/data/v1/epss"


@dataclass(frozen=True)
class EpssEntry:
    cve_id: str
    epss: float
    percentile: Optional[float]
    date: Optional[str]


def _normalize_cves(cve_ids: list[str] | tuple[str, ...]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for cve_id in cve_ids:
        norm = str(cve_id or "").strip().upper()
        if not norm.startswith("CVE-") or norm in seen:
            continue
        seen.add(norm)
        normalized.append(norm)
    return normalized


def fetch_epss_scores(
    cve_ids: list[str] | tuple[str, ...],
    *,
    timeout: int = 20,
    chunk_size: int = 100,
) -> dict[str, EpssEntry]:
    normalized = _normalize_cves(cve_ids)
    if not normalized:
        return {}

    scores: dict[str, EpssEntry] = {}
    for start in range(0, len(normalized), chunk_size):
        batch = normalized[start : start + chunk_size]
        try:
            response = requests.get(
                EPSS_API_URL,
                params={"cve": ",".join(batch)},
                headers={"Accept": "application/json"},
                timeout=timeout,
            )
            response.raise_for_status()
            payload = response.json()
        except (requests.RequestException, ValueError):
            continue

        for item in payload.get("data", []) or []:
            cve_id = str(item.get("cve", "")).strip().upper()
            try:
                epss = float(item.get("epss"))
            except (TypeError, ValueError):
                continue

            percentile_raw = item.get("percentile")
            try:
                percentile = None if percentile_raw in (None, "") else float(percentile_raw)
            except (TypeError, ValueError):
                percentile = None

            if not cve_id.startswith("CVE-"):
                continue

            scores[cve_id] = EpssEntry(
                cve_id=cve_id,
                epss=epss,
                percentile=percentile,
                date=item.get("date"),
            )

    return scores
