import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from core.storage import init_db, list_assets, list_vulnerabilities, list_controls, list_alerts

st.set_page_config(page_title="CRISP", layout="wide")
init_db()

assets = list_assets()
vulns = list_vulnerabilities()
controls = list_controls()
alerts = list_alerts(limit=500)

st.title("🛡️ Cyber Risk Intelligence Platform (CRISP)")
st.caption("Assets • Vulnerabilities • Risk Scoring • ROSI • SIEM-style Alerts • Reports")

# -------------------------
# KPIs (safe even if alerts is empty)
# -------------------------
sev_counts_kpi = pd.Series([a.severity for a in alerts]).value_counts()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Assets", len(assets))
c2.metric("Vulnerabilities", len(vulns))
c3.metric("Alerts", len(alerts))
c4.metric("Critical Alerts", int(sev_counts_kpi.get("CRITICAL", 0)))

st.divider()

# -------------------------
# If NO alerts → show instructions and stop charts
# -------------------------
if not alerts:
    st.info("No alerts found yet. Go to **Vulnerabilities → Generate alerts** to populate analytics.")
    st.stop()

# -------------------------
# From here: alerts exist ✅
# -------------------------
df = pd.DataFrame([a.model_dump() for a in alerts])

# Top risky assets table (Top 5)
top_assets_5 = (
    df.groupby("asset_id")["risk_score"]
    .max()
    .sort_values(ascending=False)
    .head(5)
    .reset_index()
)

asset_map = {a.id: a.name for a in assets if a.id is not None}
top_assets_5["asset_name"] = top_assets_5["asset_id"].map(asset_map)

st.subheader("🔥 Top 5 Risky Assets (by max risk score)")
st.dataframe(top_assets_5[["asset_name", "risk_score"]], use_container_width=True)

st.divider()

# -------------------------
# Charts
# -------------------------
st.subheader("📊 Risk Overview")

# Severity distribution
sev_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
sev_counts = (
    df["severity"]
    .value_counts()
    .reindex(sev_order)
    .fillna(0)
    .astype(int)
)
st.bar_chart(sev_counts, use_container_width=True)

# Top risky assets chart (Top 10)
top_assets_10 = (
    df.groupby("asset_id")["risk_score"]
    .max()
    .sort_values(ascending=False)
    .head(10)
    .reset_index()
)
top_assets_10["asset_name"] = top_assets_10["asset_id"].map(asset_map)
top_assets_chart = top_assets_10[["asset_name", "risk_score"]].set_index("asset_name")

st.subheader("🔥 Top 10 Risky Assets")
st.bar_chart(top_assets_chart, use_container_width=True)

# Risk score distribution (bucket counts)
st.subheader("📈 Risk Score Distribution")
bins = [0, 5, 9, 12, 100]
labels = ["LOW (<5)", "MEDIUM (5–8.99)", "HIGH (9–11.99)", "CRITICAL (12+)"]

df["risk_bucket"] = pd.cut(df["risk_score"], bins=bins, labels=labels, right=False)
bucket_counts = (
    df["risk_bucket"]
    .value_counts()
    .reindex(labels)
    .fillna(0)
    .astype(int)
)

st.bar_chart(bucket_counts, use_container_width=True)