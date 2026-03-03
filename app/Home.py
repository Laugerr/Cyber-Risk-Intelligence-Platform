import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import streamlit as st
from core.storage import init_db, list_assets, list_vulnerabilities, list_controls

st.set_page_config(page_title="CRISP", layout="wide")
init_db()

assets = list_assets()
vulns = list_vulnerabilities()
controls = list_controls()

st.title("🛡️ Cyber Risk Intelligence Platform (CRISP)")
st.caption("Enterprise-style simulated cyber risk dashboard: Assets • Vulnerabilities • Risk Scoring • ROSI • Reports")

c1, c2, c3 = st.columns(3)
c1.metric("Assets", len(assets))
c2.metric("Vulnerabilities", len(vulns))
c3.metric("Controls", len(controls))

st.success("✅ Database ready. Next: risk scoring + alerts + UI pages.")