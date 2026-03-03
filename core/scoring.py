from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]


@dataclass(frozen=True)
class RiskResult:
    risk_score: float
    severity: Severity


def calculate_risk(
    cvss: float,
    criticality: int,
    internet_exposed: bool,
    known_exploited: bool,
) -> RiskResult:
    """
    Simple explainable model:
    - Start from CVSS (0-10)
    - Multiply by criticality factor (1.0 -> 1.6)
    - Multiply by exposure (1.3 if internet exposed)
    - Add bonus if known exploited (+0.5)
    """
    criticality_factor = 1.0 + (max(1, min(5, criticality)) - 1) * 0.15  # 1.0..1.6
    exposure_factor = 1.3 if internet_exposed else 1.0
    exploited_bonus = 0.5 if known_exploited else 0.0

    score = (float(cvss) * criticality_factor * exposure_factor) + exploited_bonus
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

    return RiskResult(risk_score=score, severity=sev)