import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from core.models import Vulnerability
from core.storage import (
    init_db,
    list_assets,
    add_vulnerability,
    list_vulnerabilities,
    list_alerts,
    export_alerts_json,
)
from core.scoring import calculate_risk
from core.sample_data import generate_alerts_from_vulns

st.set_page_config(page_title="CRISP • Vulnerabilities", layout="wide")
init_db()

st.title("🕷️ Vulnerabilities")
st.caption("Track vulnerabilities, calculate risk, and generate SIEM-style alerts.")

assets = list_assets()
asset_map = {a.id: a for a in assets if a.id is not None}

# -------------------------
# Add Vulnerability
# -------------------------
st.subheader("➕ Add Vulnerability")

if not assets:
    st.warning("Add assets first in the Assets page.")
else:
    with st.form("add_vuln_form", clear_on_submit=True):
        col1, col2, col3 = st.columns(3)

        asset_choice = col1.selectbox(
            "Asset*",
            options=[(a.id, a.name) for a in assets if a.id is not None],
            format_func=lambda x: x[1],
        )
        cve = col2.text_input("CVE*", placeholder="e.g., CVE-2026-1234")
        title = col3.text_input("Title*", placeholder="Short description")

        col4, col5 = st.columns(2)
        cvss = col4.slider("CVSS (0–10)", 0.0, 10.0, 7.5, 0.1)
        known_exploited = col5.checkbox("Known Exploited / PoC Available")

        submitted = st.form_submit_button("Add Vulnerability ✅")

        if submitted:
            asset_id = int(asset_choice[0])
            if not cve.strip() or not title.strip():
                st.error("CVE and Title are required.")
            else:
                v = Vulnerability(
                    asset_id=asset_id,
                    cve=cve.strip(),
                    title=title.strip(),
                    cvss=float(cvss),
                    known_exploited=bool(known_exploited),
                )
                new_id = add_vulnerability(v)
                st.success(f"Vulnerability added (id={new_id}).")

st.divider()

# -------------------------
# Alerts Actions
# -------------------------
st.subheader("🚨 Alerts Actions")
c1, c2, c3 = st.columns(3)

if c1.button("⚡ Generate alerts from vulnerabilities"):
    generate_alerts_from_vulns(limit=500)
    st.success("Alerts generated from current vulnerabilities.")

if c2.button("📤 Export alerts as SIEM JSON"):
    out_path = export_alerts_json()
    st.success(f"Exported: {out_path}")

alerts_count = len(list_alerts(limit=500))
c3.metric("Alerts in DB", alerts_count)

st.divider()

# -------------------------
# Vulnerabilities Table
# -------------------------
st.subheader("📋 Vulnerability List")

vulns = list_vulnerabilities()
if not vulns:
    st.info("No vulnerabilities yet. Add some above or seed demo data.")
else:
    rows = []
    for v in vulns:
        a = asset_map.get(v.asset_id)
        if not a:
            continue

        rr = calculate_risk(
            cvss=v.cvss,
            criticality=a.criticality,
            internet_exposed=a.internet_exposed,
            known_exploited=v.known_exploited,
        )

        rows.append(
            {
                "severity": rr.severity,
                "risk_score": rr.risk_score,
                "asset_name": a.name,
                "cve": v.cve,
                "cvss": v.cvss,
                "known_exploited": v.known_exploited,
                "internet_exposed": a.internet_exposed,
                "criticality": a.criticality,
                "title": v.title,
                "detected_at": str(v.detected_at),
            }
        )

    df = pd.DataFrame(rows)

    f1, f2, f3 = st.columns(3)
    asset_filter = f1.selectbox("Filter by Asset", ["All"] + sorted(df["asset_name"].unique().tolist()))
    severity_filter = f2.selectbox("Filter by Severity", ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"])
    exploited_filter = f3.selectbox("Known Exploited?", ["All", "Yes", "No"])

    filtered = df.copy()
    if asset_filter != "All":
        filtered = filtered[filtered["asset_name"] == asset_filter]
    if severity_filter != "All":
        filtered = filtered[filtered["severity"] == severity_filter]
    if exploited_filter == "Yes":
        filtered = filtered[filtered["known_exploited"] == True]
    elif exploited_filter == "No":
        filtered = filtered[filtered["known_exploited"] == False]

    filtered = filtered.sort_values(by=["risk_score", "cvss"], ascending=False)

    st.dataframe(filtered, use_container_width=True)