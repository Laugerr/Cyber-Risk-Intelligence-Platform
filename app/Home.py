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
sev_counts_kpi = df["severity"].value_counts()

c1, c2, c3, c4 = st.columns(4)
c1.metric("Assets", len(assets))
c2.metric("Vulnerabilities", len(vulns))
c3.metric("Alerts", len(df))
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

# -------------------------
# Time Range Filter
# -------------------------
st.divider()
st.subheader("🗓️ Time Filter")

time_range = st.selectbox(
    "Select dashboard time range",
    ["Last 7 Days", "Last 30 Days", "All Time"],
    index=1,
)

df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")

if time_range == "Last 7 Days":
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=7)
    df = df[df["created_at"] >= cutoff]
elif time_range == "Last 30 Days":
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=30)
    df = df[df["created_at"] >= cutoff]

if df.empty:
    st.warning(f"No alerts found for selected range: {time_range}")
    st.stop()


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

st.subheader("📈 Risk Trend Dashboard")

# Convert created_at to datetime
df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
df["date"] = df["created_at"].dt.date

# Risk score trend by day
daily_risk = (
    df.groupby("date")["risk_score"]
    .sum()
    .reset_index()
    .sort_values("date")
)

st.markdown("### Total Risk Score Over Time")
if not daily_risk.empty:
    risk_chart = daily_risk.set_index("date")[["risk_score"]]
    st.line_chart(risk_chart, use_container_width=True)
else:
    st.info("Not enough data to display risk trend.")

# Alert count trend by day
daily_alerts = (
    df.groupby("date")
    .size()
    .reset_index(name="alert_count")
    .sort_values("date")
)

st.markdown("### Alert Volume Over Time")
if not daily_alerts.empty:
    alerts_chart = daily_alerts.set_index("date")[["alert_count"]]
    st.bar_chart(alerts_chart, use_container_width=True)
else:
    st.info("Not enough data to display alert trend.")

st.markdown("### Severity Trend Over Time")

severity_trend = (
    df.groupby(["date", "severity"])
    .size()
    .reset_index(name="count")
)

if not severity_trend.empty:
    sev_pivot = severity_trend.pivot(index="date", columns="severity", values="count").fillna(0)

    # keep severity order if columns exist
    severity_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    sev_pivot = sev_pivot[[c for c in severity_order if c in sev_pivot.columns]]

    st.line_chart(sev_pivot, use_container_width=True)
else:
    st.info("Not enough data to display severity trend.")

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