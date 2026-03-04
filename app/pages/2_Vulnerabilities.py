import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from core.models import Vulnerability
from core.cve_nvd import search_cves, get_cve_by_id
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

# Always fetch fresh assets (can change during the session)
assets = list_assets()
asset_map = {a.id: a for a in assets if a.id is not None}

# -------------------------
# NVD Search + Multi Import
# -------------------------
st.subheader("🌐 Search NVD (Real CVEs)")

# Read API key from Streamlit secrets
api_key = None
try:
    api_key = st.secrets.get("NVD_API_KEY")
except Exception:
    api_key = None

# Cache API calls (avoid rate limits / faster UI)
@st.cache_data(ttl=3600, show_spinner=False)
def cached_search(q: str, key: str | None, limit: int):
    return search_cves(q, key, limit=limit)

# Persist results across reruns
if "nvd_results" not in st.session_state:
    st.session_state["nvd_results"] = []

with st.expander("Search and import CVEs into an asset", expanded=True):
    c1, c2 = st.columns([2, 1])
    keyword = c1.text_input("Keyword search", placeholder="e.g., jira, gitlab, openssl")
    max_results = c2.selectbox("Max results", [10, 20, 50], index=1)

    if st.button("🔎 Search NVD"):
        if not keyword.strip():
            st.warning("Type a keyword first.")
        else:
            with st.spinner("Searching NVD..."):
                st.session_state["nvd_results"] = cached_search(keyword.strip(), api_key, max_results)

    results = st.session_state["nvd_results"]

    if not results:
        st.info("Search NVD to see results here.")
    else:
        # Preview table
        df_nvd = pd.DataFrame(
            [
                {
                    "cve": r.cve_id,
                    "cvss": "" if r.cvss is None else r.cvss,
                    "published": r.published or "",
                    "summary": (r.description[:160] + "…") if r.description else "",
                    "url": r.url,
                }
                for r in results
            ]
        )
        st.dataframe(df_nvd, use_container_width=True)

        # -------------------------
        # CVE DETAILS VIEWER (NO NESTED EXPANDER)
        # -------------------------
        st.divider()
        st.subheader("🔎 View CVE Details")

        view_id = st.selectbox(
            "Select a CVE to view",
            options=[r.cve_id for r in results],
            key="nvd_view_id",
        )

        def cvss_to_severity(cvss: float | None) -> str:
            if cvss is None:
                return "⚪ N/A"
            if cvss >= 9.0:
                return "🔴 CRITICAL"
            if cvss >= 7.0:
                return "🟠 HIGH"
            if cvss >= 4.0:
                return "🟡 MEDIUM"
            return "🟢 LOW"


        def cvss_to_progress(cvss: float | None) -> float:
            if cvss is None:
                return 0.0
            return max(0.0, min(float(cvss) / 10.0, 1.0))

        details = get_cve_by_id(view_id, api_key)

        if details:
            st.markdown(f"### {details.cve_id}")
            st.write(details.description or "No description.")

            sev_label = cvss_to_severity(details.cvss)
            cvss_val = details.cvss

            c1, c2 = st.columns([1, 2])
            c1.metric("Severity", sev_label)
            c2.metric("CVSS", f"{cvss_val:.1f}/10" if cvss_val is not None else "N/A")

            st.progress(cvss_to_progress(cvss_val))
            
            st.write(f"**Published:** {details.published or 'N/A'}")
            st.write(f"**Last Modified:** {details.last_modified or 'N/A'}")
            st.markdown(f"[Open in NVD]({details.url})")

        st.divider()
        st.subheader("📥 Import Settings")

        # Multi-select CVEs
        cve_options = [r.cve_id for r in results]
        selected_cves = st.multiselect(
            "Select CVEs to import (multi-select)",
            options=cve_options,
            default=cve_options[:1],
        )

        # Reload assets so list is always current
        assets_now = list_assets()
        asset_options = [(a.id, a.name) for a in assets_now if a.id is not None]

        if not asset_options:
            st.warning("No assets available. Add assets first in the Assets page.")
        else:
            asset_pick = st.selectbox(
                "Import into asset",
                options=asset_options,
                format_func=lambda x: x[1],
            )

            colA, colB, colC = st.columns(3)
            avoid_dupes = colA.checkbox("Skip duplicates", value=True)
            set_known_exploited = colB.checkbox("Mark as Known Exploited", value=False)
            default_cvss = colC.number_input(
                "Default CVSS if missing",
                min_value=0.0,
                max_value=10.0,
                value=5.0,
                step=0.1,
            )

            source_tag = st.text_input("Title prefix / source tag", value="[NVD]")

            if st.button("➕ Import selected CVEs into asset"):
                if not selected_cves:
                    st.warning("Select at least one CVE.")
                else:
                    # Build duplicate set (only for selected asset)
                    existing = set()
                    if avoid_dupes:
                        for vv in list_vulnerabilities():
                            if vv.asset_id == int(asset_pick[0]):
                                existing.add(vv.cve.strip().upper())

                    imported, skipped = 0, 0
                    skipped_list = []

                    for cve_id in selected_cves:
                        chosen = next((r for r in results if r.cve_id == cve_id), None)
                        if not chosen:
                            skipped += 1
                            skipped_list.append(cve_id)
                            continue

                        norm = chosen.cve_id.strip().upper()
                        if avoid_dupes and norm in existing:
                            skipped += 1
                            skipped_list.append(chosen.cve_id)
                            continue

                        cvss_val = float(chosen.cvss) if chosen.cvss is not None else float(default_cvss)

                        # Title includes source tag + short description + link hint
                        base_title = chosen.description.strip() if chosen.description else "Imported from NVD"
                        base_title = base_title.replace("\n", " ").strip()
                        base_title = base_title[:120]

                        title = f"{source_tag} {base_title}".strip()

                        v = Vulnerability(
                            asset_id=int(asset_pick[0]),
                            cve=chosen.cve_id,
                            title=title,
                            cvss=cvss_val,
                            known_exploited=bool(set_known_exploited),
                        )
                        add_vulnerability(v)
                        imported += 1

                    st.success(
                        f"✅ Imported {imported} CVE(s) into {asset_pick[1]}."
                        + (f" Skipped {skipped}." if skipped else "")
                    )

                    if skipped_list:
                        st.caption("Skipped CVEs (duplicates or missing in results):")
                        st.code(", ".join(skipped_list))

st.divider()

# -------------------------
# Add Vulnerability (manual)
# -------------------------
st.subheader("➕ Add Vulnerability")

assets = list_assets()
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
                st.success(f"✅ Vulnerability added (id={new_id}).")

st.divider()

# -------------------------
# Alerts Actions
# -------------------------
st.subheader("🚨 Alerts Actions")
c1, c2, c3 = st.columns(3)

if c1.button("⚡ Generate alerts from vulnerabilities"):
    generate_alerts_from_vulns(limit=500)
    st.success("✅ Alerts generated from current vulnerabilities.")

if c2.button("📤 Export alerts as SIEM JSON"):
    out_path = export_alerts_json()
    st.success(f"✅ Exported: {out_path}")

alerts_count = len(list_alerts(limit=500))
c3.metric("Alerts in DB", alerts_count)

st.divider()

# -------------------------
# Vulnerabilities Table
# -------------------------
st.subheader("📋 Vulnerability List")

assets = list_assets()
asset_map = {a.id: a for a in assets if a.id is not None}

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

    # Visual severity labels (compatible across Streamlit versions)
    severity_icon = {
        "CRITICAL": "🔴 CRITICAL",
        "HIGH": "🟠 HIGH",
        "MEDIUM": "🟡 MEDIUM",
        "LOW": "🟢 LOW",
    }
    df["severity"] = df["severity"].map(severity_icon).fillna(df["severity"])

    st.subheader("📊 Vulnerability Risk Breakdown")
    sev_order = ["🔴 CRITICAL", "🟠 HIGH", "🟡 MEDIUM", "🟢 LOW"]
    sev_counts = df["severity"].value_counts().reindex(sev_order).fillna(0).astype(int)
    st.bar_chart(sev_counts, use_container_width=True)

    f1, f2, f3 = st.columns(3)
    asset_filter = f1.selectbox("Filter by Asset", ["All"] + sorted(df["asset_name"].unique().tolist()))
    severity_filter = f2.selectbox("Filter by Severity", ["All"] + sev_order)
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