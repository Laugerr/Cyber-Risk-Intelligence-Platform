from __future__ import annotations
from typing import Tuple


def estimate_ale(total_risk_score: float) -> float:
    """
    Very simple model:
    Convert total risk score into estimated annual loss.
    You can refine this later.
    """
    # Each risk point = €10,000 exposure (demo logic)
    return round(total_risk_score * 10000, 2)


def calculate_rosi(
    ale_before: float,
    control_cost: float,
    effectiveness_pct: int,
) -> Tuple[float, float]:
    """
    ROSI formula:
    ROSI = (Risk_Reduction_Value - Control_Cost) / Control_Cost
    """

    risk_reduction_value = ale_before * (effectiveness_pct / 100)
    rosi = (risk_reduction_value - control_cost) / control_cost

    return round(risk_reduction_value, 2), round(rosi, 2)