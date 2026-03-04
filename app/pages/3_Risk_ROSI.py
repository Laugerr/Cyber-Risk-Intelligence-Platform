import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from core.storage import init_db, list_alerts, list_controls
from core.rosi import estimate_ale, calculate_rosi

st.set_page_config(page_title="CRISP • Risk & ROSI", layout="wide")
init_db()

st.title("💰 Risk Quantification & ROSI")
st.caption("Estimate Annual Loss Expectancy and evaluate security investment decisions.")

alerts = list_alerts(limit=1000)
controls = list_controls()

if not alerts:
    st.warning("No alerts found. Generate alerts from the Vulnerabilities page first.")
    st.stop()

# -------------------------
# Total Risk Exposure
# -------------------------
df = pd.DataFrame([a.model_dump() for a in alerts])
total_risk_score = df["risk_score"].sum()

ale = estimate_ale(total_risk_score)

c1, c2 = st.columns(2)
c1.metric("Total Risk Score", round(total_risk_score, 2))
c2.metric("Estimated Annual Loss (ALE €)", f"{ale:,.2f}")

st.divider()

# -------------------------
# Control Selection
# -------------------------
st.subheader("🛡️ Evaluate a Security Control")

if not controls:
    st.warning("No controls found. Seed demo data from Assets page.")
    st.stop()

control_options = {c.id: c for c in controls if c.id is not None}

selected_id = st.selectbox(
    "Select Control",
    options=list(control_options.keys()),
    format_func=lambda x: control_options[x].name,
)

control = control_options[selected_id]

st.write(f"**Annual Cost:** €{control.annual_cost_eur:,.2f}")
st.write(f"**Effectiveness:** {control.effectiveness_pct}%")
st.write(f"**Notes:** {control.notes}")

st.divider()

# -------------------------
# ROSI Calculation
# -------------------------
risk_reduction_value, rosi = calculate_rosi(
    ale_before=ale,
    control_cost=control.annual_cost_eur,
    effectiveness_pct=control.effectiveness_pct,
)

c3, c4 = st.columns(2)
c3.metric("Estimated Risk Reduction Value (€)", f"{risk_reduction_value:,.2f}")
c4.metric("ROSI", rosi)

st.divider()

# Executive Explanation
if rosi > 0:
    st.success(
        f"✅ This control is financially justified. "
        f"Projected savings exceed cost. ROSI = {rosi}"
    )
else:
    st.error(
        f"⚠️ This control may not be financially justified based on current risk model. "
        f"ROSI = {rosi}"
    )