import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import streamlit as st

from core.storage import init_db, export_alerts_json, list_controls
from core.reporting import generate_exec_html_report

st.set_page_config(page_title="CRISP • Reports", layout="wide")
init_db()

st.title("📑 Reports & Exports")
st.caption("Generate executive reports and export SIEM-style alert bundles.")

st.subheader("📤 Export Alerts (SIEM JSON)")
if st.button("Export alerts JSON ✅"):
    out = export_alerts_json()
    st.success(f"Exported: {out}")

st.divider()

st.subheader("🧾 Generate Executive HTML Report")

controls = list_controls()
control_id = None

if controls:
    options = {c.id: c.name for c in controls if c.id is not None}
    control_id = st.selectbox(
        "Pick a control to evaluate in the report",
        options=list(options.keys()),
        format_func=lambda x: options[x],
    )

if st.button("Generate Executive Report ✅"):
    report_path = generate_exec_html_report(selected_control_id=control_id)
    st.success(f"Report generated: {report_path}")

    # show preview link + raw HTML
    html = Path(report_path).read_text(encoding="utf-8")
    st.download_button(
        label="⬇️ Download HTML report",
        data=html,
        file_name=Path(report_path).name,
        mime="text/html",
    )

    st.divider()
    st.subheader("Preview")
    st.components.v1.html(html, height=700, scrolling=True)