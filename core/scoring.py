from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


@dataclass(frozen=True)
class RiskResult:
    risk_score: float
    severity: Severity
    exploited_bonus: float = 0.0
    kev_bonus: float = 0.0
    epss_bonus: float = 0.0


def calculate_risk(
    cvss: float,
    criticality: int,
    internet_exposed: bool,
    known_exploited: bool,
    kev: bool = False,
    epss_score: float | None = None,
) -> RiskResult:
    """
    Simple explainable model:
    - Start from CVSS (0-10)
    - Multiply by criticality factor (1.0 -> 1.6)
    - Multiply by exposure (1.3 if internet exposed)
    - Add bonus if exploited evidence exists
    - Add extra bonus if the CVE is in CISA KEV
    - Add a probability bonus from EPSS
    """
    criticality_factor = 1.0 + (max(1, min(5, criticality)) - 1) * 0.15  # 1.0..1.6
    exposure_factor = 1.3 if internet_exposed else 1.0
    exploited_bonus = 0.5 if known_exploited else 0.0
    kev_bonus = 1.5 if kev else 0.0

    normalized_epss = 0.0 if epss_score is None else max(0.0, min(1.0, float(epss_score)))
    if normalized_epss >= 0.9:
        epss_bonus = 1.5
    elif normalized_epss >= 0.7:
        epss_bonus = 1.1
    elif normalized_epss >= 0.4:
        epss_bonus = 0.7
    elif normalized_epss >= 0.2:
        epss_bonus = 0.35
    else:
        epss_bonus = 0.0

    score = (float(cvss) * criticality_factor * exposure_factor) + exploited_bonus + kev_bonus + epss_bonus
    # Keep within a friendly range
    score = round(score, 2)

    if score >= 12:
        sev: Severity = "CRITICAL"
    elif score >= 9:
        sev = "HIGH"
    elif score >= 5:
        sev = "MEDIUM"
    else:
        sev = "LOW"

    return RiskResult(
        risk_score=score,
        severity=sev,
        exploited_bonus=exploited_bonus,
        kev_bonus=kev_bonus,
        epss_bonus=epss_bonus,
    )
