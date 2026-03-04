import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from core.storage import init_db, export_alerts_json, list_controls, list_alerts
from core.reporting import generate_exec_html_report

st.set_page_config(page_title="CRISP • Reports", layout="wide")
init_db()

st.title("📑 Reports & Exports")
st.caption("Generate executive reports and export SIEM-style alerts.")

alerts = list_alerts(limit=2000)

# -------------------------
# Visual Summary (on the page)
# -------------------------
st.subheader("📊 Snapshot")

if alerts:
    df = pd.DataFrame([a.model_dump() for a in alerts])
    sev_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    sev_counts = df["severity"].value_counts().reindex(sev_order).fillna(0).astype(int)

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total Alerts", len(df))
    c2.metric("Critical", int(sev_counts.get("CRITICAL", 0)))
    c3.metric("High", int(sev_counts.get("HIGH", 0)))
    c4.metric("Medium", int(sev_counts.get("MEDIUM", 0)))

    st.bar_chart(sev_counts, use_container_width=True)

    st.caption("Top 10 alerts by risk score")
    top = df.sort_values(by="risk_score", ascending=False).head(10)
    st.dataframe(top[["severity", "risk_score", "title", "cve", "created_at"]], use_container_width=True)
else:
    st.info("No alerts yet. Go to Vulnerabilities page → Generate alerts.")

st.divider()

# -------------------------
# Export Alerts JSON
# -------------------------
st.subheader("📤 Export Alerts (SIEM JSON)")

if st.button("Export alerts JSON ✅"):
    out = export_alerts_json()
    st.success(f"Exported: {out}")

    # Provide download
    json_text = Path(out).read_text(encoding="utf-8")
    st.download_button(
        label="⬇️ Download alerts JSON",
        data=json_text,
        file_name=Path(out).name,
        mime="application/json",
    )

st.divider()

# -------------------------
# Executive HTML Report
# -------------------------
st.subheader("🧾 Executive HTML Report")

controls = list_controls()
control_id = None

if controls:
    options = {c.id: c.name for c in controls if c.id is not None}
    control_id = st.selectbox(
        "Pick a control to evaluate inside the report",
        options=list(options.keys()),
        format_func=lambda x: options[x],
    )
else:
    st.warning("No controls found. Seed demo data from Assets page if needed.")

if st.button("Generate Executive Report ✅"):
    report_path = generate_exec_html_report(selected_control_id=control_id)
    st.success(f"Report generated: {report_path}")

    html = Path(report_path).read_text(encoding="utf-8")

    st.download_button(
        label="⬇️ Download HTML report",
        data=html,
        file_name=Path(report_path).name,
        mime="text/html",
    )

    st.divider()
    st.subheader("Preview")
    st.components.v1.html(html, height=750, scrolling=True)