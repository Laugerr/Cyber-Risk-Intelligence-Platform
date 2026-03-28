import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import altair as alt
import pandas as pd
import streamlit as st

from core.cisa_kev import fetch_kev_cve_set, is_cve_in_kev
from core.cve_nvd import get_cve_by_id, search_cves
from core.models import Vulnerability
from core.sample_data import generate_alerts_from_vulns
from core.scoring import calculate_risk
from core.storage import (
    add_vulnerability,
    export_alerts_json,
    init_db,
    list_alerts,
    list_assets,
    list_vulnerabilities,
    mark_vulnerabilities_known_exploited_from_cves,
)


st.set_page_config(page_title="CRISP • Vulnerabilities", layout="wide")
init_db()

SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
SEVERITY_COLORS = {
    "CRITICAL": "#ff4258",
    "HIGH": "#ff9a2a",
    "MEDIUM": "#ffd043",
    "LOW": "#4cd47a",
}


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        .stApp {
            background:
                radial-gradient(circle at top left, rgba(25, 116, 210, 0.18), transparent 28%),
                radial-gradient(circle at top right, rgba(255, 66, 113, 0.1), transparent 24%),
                linear-gradient(180deg, #060814 0%, #090d1c 55%, #060812 100%);
            color: #eef2ff;
        }

        [data-testid="stHeader"] {
            background: rgba(0, 0, 0, 0);
        }

        [data-testid="stAppViewContainer"] > .main {
            padding-top: 0.15rem;
        }

        .block-container {
            max-width: 1120px;
            padding-top: 0 !important;
            padding-bottom: 2rem;
        }

        .page-shell {
            border: 1px solid rgba(153, 169, 255, 0.16);
            border-radius: 22px;
            padding: 1rem 1.15rem;
            background: linear-gradient(180deg, rgba(13, 18, 40, 0.96), rgba(7, 10, 24, 0.97));
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
            margin-bottom: 1.15rem;
        }

        .hero-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .hero-bar {
            display: flex;
            align-items: center;
            gap: 0.85rem;
            padding: 0.9rem 1rem;
            border-radius: 18px;
            background: linear-gradient(90deg, rgba(22, 28, 58, 0.96), rgba(18, 22, 45, 0.88));
            border: 1px solid rgba(122, 138, 214, 0.14);
            flex: 1;
            min-width: 280px;
        }

        .hero-icon {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 120, 120, 0.1);
            color: #ff6d73;
            font-size: 1rem;
            border: 1px solid rgba(255, 106, 127, 0.25);
        }

        .hero-title {
            font-size: 1.45rem;
            font-weight: 800;
            letter-spacing: 0.01em;
            margin: 0;
            color: #f7f8ff;
        }

        .hero-subtitle {
            margin: 0.15rem 0 0;
            color: #95a0cb;
            font-size: 0.92rem;
        }

        .metric-card {
            border-radius: 14px;
            padding: 0.95rem 1rem;
            border: 1px solid rgba(130, 149, 232, 0.16);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
            min-height: 88px;
        }

        .metric-card.indigo {
            background: linear-gradient(135deg, rgba(42, 39, 108, 0.94), rgba(24, 20, 76, 0.84));
        }

        .metric-card.red {
            background: linear-gradient(135deg, rgba(108, 31, 55, 0.96), rgba(86, 18, 37, 0.9));
        }

        .metric-card.orange {
            background: linear-gradient(135deg, rgba(104, 58, 23, 0.94), rgba(76, 35, 14, 0.88));
        }

        .metric-card.gold {
            background: linear-gradient(135deg, rgba(98, 82, 24, 0.94), rgba(71, 57, 11, 0.88));
        }

        .metric-label {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            color: #d8e2ff;
            font-size: 0.95rem;
            line-height: 1.2;
        }

        .metric-icon {
            font-size: 1.2rem;
        }

        .metric-value {
            margin-top: 0.6rem;
            font-size: 1.85rem;
            font-weight: 800;
            color: #ffffff;
        }

        .panel {
            border: 1px solid rgba(130, 149, 232, 0.12);
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(21, 26, 53, 0.82), rgba(12, 16, 34, 0.9));
            padding: 0.9rem 1rem 0.75rem;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
            margin-bottom: 0.95rem;
        }

        .panel-title {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            font-size: 0.96rem;
            font-weight: 700;
            color: #ecf1ff;
            margin-bottom: 0.7rem;
        }

        .panel-title::before {
            content: "";
            width: 3px;
            height: 20px;
            border-radius: 999px;
            background: linear-gradient(180deg, #2ca7ff, #304dff);
            box-shadow: 0 0 20px rgba(56, 143, 255, 0.45);
        }

        .mini-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .severity-legend {
            display: flex;
            flex-direction: column;
            gap: 0.9rem;
            justify-content: center;
            height: 100%;
            padding-left: 0.35rem;
        }

        .severity-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: #eef2ff;
            font-size: 0.98rem;
        }

        .severity-swatch {
            width: 17px;
            height: 17px;
            border-radius: 4px;
            flex: 0 0 auto;
        }

        .mini-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0.65rem;
            border-radius: 10px;
            background: rgba(20, 26, 51, 0.88);
            border: 1px solid rgba(130, 149, 232, 0.1);
        }

        .mini-name {
            color: #f2f6ff;
            font-weight: 600;
            font-size: 0.9rem;
        }

        .mini-count {
            color: #9ec3ff;
            font-size: 0.76rem;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 64px;
            padding: 0.2rem 0.52rem;
            border-radius: 999px;
            font-size: 0.74rem;
            font-weight: 700;
            border: 1px solid transparent;
            white-space: nowrap;
        }

        .badge.sev-critical {
            background: rgba(255, 66, 88, 0.12);
            border-color: rgba(255, 66, 88, 0.18);
            color: #ff6d73;
        }

        .badge.sev-high {
            background: rgba(255, 154, 42, 0.12);
            border-color: rgba(255, 154, 42, 0.18);
            color: #ffad4b;
        }

        .badge.sev-medium {
            background: rgba(255, 208, 67, 0.12);
            border-color: rgba(255, 208, 67, 0.18);
            color: #ffd95e;
        }

        .badge.sev-low {
            background: rgba(76, 212, 122, 0.12);
            border-color: rgba(76, 212, 122, 0.18);
            color: #76de98;
        }

        .badge.status-open {
            background: rgba(96, 124, 255, 0.14);
            border-color: rgba(96, 124, 255, 0.22);
            color: #a7b9ff;
        }

        .badge.status-progress {
            background: rgba(255, 154, 42, 0.12);
            border-color: rgba(255, 154, 42, 0.18);
            color: #ffb158;
        }

        .badge.status-fixed {
            background: rgba(76, 212, 122, 0.12);
            border-color: rgba(76, 212, 122, 0.18);
            color: #7ae39b;
        }

        .badge.cvss {
            background: rgba(255, 255, 255, 0.05);
            border-color: rgba(255, 255, 255, 0.08);
            color: #f2f5ff;
            min-width: 56px;
        }

        .table-shell {
            border: 1px solid rgba(130, 149, 232, 0.12);
            border-radius: 14px;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(21, 26, 53, 0.82), rgba(12, 16, 34, 0.9));
        }

        .vuln-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        .vuln-table thead tr {
            background: rgba(18, 24, 48, 0.98);
        }

        .vuln-table th {
            text-align: left;
            font-size: 0.82rem;
            color: #d4ddff;
            padding: 0.7rem 0.75rem;
            border-bottom: 1px solid rgba(130, 149, 232, 0.14);
        }

        .vuln-table td {
            padding: 0.72rem 0.75rem;
            border-bottom: 1px solid rgba(130, 149, 232, 0.08);
            color: #eef2ff;
            font-size: 0.88rem;
            vertical-align: middle;
            background: rgba(19, 25, 49, 0.9);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .vuln-table tbody tr:last-child td {
            border-bottom: none;
        }

        .view-link {
            color: #8ec2ff;
            font-weight: 700;
            text-decoration: none;
        }

        div[data-baseweb="input"] > div,
        div[data-baseweb="base-input"] > div,
        div[data-baseweb="select"] > div,
        div[data-baseweb="select"] div[role="button"] {
            background: rgba(16, 20, 39, 0.88) !important;
            border-color: rgba(120, 136, 204, 0.2) !important;
            color: #eef2ff !important;
            border-radius: 10px !important;
        }

        .stTextInput label,
        .stSelectbox label,
        .stSlider label,
        .stCheckbox label,
        .stFileUploader label,
        .stMultiselect label,
        .stNumberInput label {
            color: #d9e2ff !important;
        }

        .stButton button,
        .stDownloadButton button,
        div[data-testid="stFormSubmitButton"] button {
            border-radius: 10px;
            background: linear-gradient(180deg, rgba(32, 40, 74, 0.96), rgba(21, 28, 56, 0.96));
            border: 1px solid rgba(129, 147, 218, 0.2);
            color: #eaf0ff;
            font-weight: 600;
        }

        .stAlert {
            background: rgba(18, 24, 48, 0.86);
            border: 1px solid rgba(126, 143, 214, 0.16);
            color: #edf2ff;
        }

        div[data-testid="stExpander"] {
            border: 1px solid rgba(130, 149, 232, 0.12);
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(21, 26, 53, 0.82), rgba(12, 16, 34, 0.9));
            overflow: hidden;
        }

        div[data-testid="stHorizontalBlock"] {
            gap: 1rem;
            margin-bottom: 0.9rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_metric_card(icon: str, label: str, value: int, tone: str) -> None:
    st.markdown(
        dedent(
            f"""
            <div class="metric-card {tone}">
                <div class="metric-label">
                    <span class="metric-icon">{icon}</span>
                    <span>{label}</span>
                </div>
                <div class="metric-value">{value}</div>
            </div>
            """
        ).strip(),
        unsafe_allow_html=True,
    )


def badge_class_for_severity(severity: str) -> str:
    return {
        "CRITICAL": "sev-critical",
        "HIGH": "sev-high",
        "MEDIUM": "sev-medium",
        "LOW": "sev-low",
    }.get(severity, "sev-low")


def derive_status(row: pd.Series) -> str:
    if row["known_exploited"]:
        return "In Progress"
    if row["risk_score"] < 5:
        return "Fixed"
    return "Open"


def status_class(status: str) -> str:
    return {
        "Open": "status-open",
        "In Progress": "status-progress",
        "Fixed": "status-fixed",
    }.get(status, "status-open")


def derive_source(title: str) -> str:
    title_upper = title.upper()
    if "[NVD]" in title_upper:
        return "NVD"
    if "KEV" in title_upper:
        return "KEV"
    return "Manual"


def time_ago(value: pd.Timestamp) -> str:
    now = pd.Timestamp.now().tz_localize(None)
    normalized = value.tz_localize(None) if getattr(value, "tzinfo", None) else value
    delta = now - normalized
    seconds = max(int(delta.total_seconds()), 0)
    if seconds < 3600:
        minutes = max(seconds // 60, 1)
        return f"{minutes} min ago"
    if seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours != 1 else ''} ago"
    days = seconds // 86400
    if days < 7:
        return f"{days} day{'s' if days != 1 else ''} ago"
    weeks = days // 7
    return f"{weeks} week{'s' if weeks != 1 else ''} ago"


def build_vuln_trend_chart(df: pd.DataFrame) -> alt.Chart:
    return (
        alt.Chart(df)
        .mark_line(point=alt.OverlayMarkDef(filled=True, size=65), strokeWidth=3, color="#ff8c3a")
        .encode(
            x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#b5bfec", grid=False, labelAngle=0)),
            y=alt.Y("count:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            tooltip=[alt.Tooltip("label:N", title="Date"), alt.Tooltip("count:Q", title="Vulnerabilities")],
        )
        .properties(height=230)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_severity_pie(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=SEVERITY_ORDER,
        range=[SEVERITY_COLORS[s] for s in SEVERITY_ORDER],
    )
    return (
        alt.Chart(df)
        .mark_arc(innerRadius=52, outerRadius=102, cornerRadius=8, padAngle=0.03)
        .encode(
            theta=alt.Theta("count:Q"),
            color=alt.Color("severity:N", scale=color_scale, legend=None),
            tooltip=[
                alt.Tooltip("severity:N", title="Severity"),
                alt.Tooltip("count:Q", title="Count"),
                alt.Tooltip("pct_text:N", title="Share"),
            ],
        )
        .properties(height=230)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def render_severity_legend(df: pd.DataFrame) -> None:
    legend_rows = []
    for row in df.itertuples(index=False):
        legend_rows.append(
            dedent(
                f"""
                <div class="severity-item">
                    <span class="severity-swatch" style="background:{SEVERITY_COLORS[row.severity]};"></span>
                    <span>{row.pct_text} {row.severity.title()}</span>
                </div>
                """
            ).strip()
        )

    st.markdown(f'<div class="severity-legend">{"".join(legend_rows)}</div>', unsafe_allow_html=True)


def render_top_assets_list(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No asset impact data available yet.")
        return

    rows = []
    for row in df.itertuples(index=False):
        badge_class = badge_class_for_severity(row.top_severity)
        rows.append(
            dedent(
                f"""
                <div class="mini-row">
                    <div>
                        <div class="mini-name">{row.asset_name}</div>
                        <div class="mini-count">{int(row.vuln_count)} vulnerabilities</div>
                    </div>
                    <span class="badge {badge_class}">{row.top_severity.title()}</span>
                </div>
                """
            ).strip()
        )

    st.markdown(f'<div class="mini-list">{"".join(rows)}</div>', unsafe_allow_html=True)


def render_vuln_table(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No vulnerabilities match the selected filters.")
        return

    table_df = df.copy()
    severity_label = {
        "CRITICAL": "🔴 Critical",
        "HIGH": "🟠 High",
        "MEDIUM": "🟡 Medium",
        "LOW": "🟢 Low",
    }
    table_df["severity"] = table_df["severity"].map(severity_label).fillna(table_df["severity"])
    table_df["status"] = table_df["status"]
    table_df["source"] = table_df["source"]
    table_df["known_exploited_display"] = table_df["known_exploited"].map({True: "Yes", False: "No"})
    table_df["kev_display"] = table_df["kev"].map({True: "🚨 KEV", False: ""})
    table_df["detected"] = table_df["detected_label"]
    table_df["action"] = table_df["detail_url"]

    st.dataframe(
        table_df[
            [
                "cve",
                "title",
                "asset_name",
                "severity",
                "cvss",
                "known_exploited_display",
                "kev_display",
                "status",
                "source",
                "detected",
                "action",
            ]
        ].rename(
            columns={
                "cve": "CVE ID",
                "title": "Title",
                "asset_name": "Asset",
                "severity": "Severity",
                "cvss": "CVSS Score",
                "known_exploited_display": "Known Exploited",
                "kev_display": "KEV",
                "status": "Status",
                "source": "Source",
                "detected": "Detected",
                "action": "View Details",
            }
        ),
        use_container_width=True,
        hide_index=True,
        column_config={
            "CVSS Score": st.column_config.NumberColumn("CVSS Score", format="%.1f", width="small"),
            "View Details": st.column_config.LinkColumn("View Details", display_text="Open", width="small"),
        },
    )


inject_styles()

assets = list_assets()
asset_map = {a.id: a for a in assets if a.id is not None}

api_key = None
try:
    api_key = st.secrets.get("NVD_API_KEY")
except Exception:
    api_key = None


@st.cache_data(ttl=3600, show_spinner=False)
def cached_search(q: str, key: str | None, limit: int):
    return search_cves(q, key, limit=limit)


@st.cache_data(ttl=3600, show_spinner=False)
def cached_kev_cves() -> set[str]:
    return fetch_kev_cve_set()


if "nvd_results" not in st.session_state:
    st.session_state["nvd_results"] = []


kev_cves = cached_kev_cves()

vulns = list_vulnerabilities()
rows = []
for v in vulns:
    a = asset_map.get(v.asset_id)
    if not a:
        continue

    kev_flag = is_cve_in_kev(v.cve, kev_cves)
    effective_known_exploited = bool(v.known_exploited or kev_flag)

    rr = calculate_risk(
        cvss=v.cvss,
        criticality=a.criticality,
        internet_exposed=a.internet_exposed,
        known_exploited=effective_known_exploited,
    )
    detected_at = pd.to_datetime(v.detected_at, errors="coerce")
    status = derive_status(
        pd.Series(
            {
                "known_exploited": effective_known_exploited,
                "risk_score": rr.risk_score,
            }
        )
    )
    source = derive_source(v.title)
    rows.append(
        {
            "severity": rr.severity,
            "risk_score": rr.risk_score,
            "asset_id": v.asset_id,
            "asset_name": a.name,
            "cve": v.cve,
            "cvss": v.cvss,
            "known_exploited": effective_known_exploited,
            "kev": kev_flag,
            "criticality": a.criticality,
            "title": v.title,
            "detected_at": detected_at,
            "status": status,
            "source": source,
            "detail_url": f"https://nvd.nist.gov/vuln/detail/{v.cve}",
        }
    )

df = pd.DataFrame(rows)

st.markdown(
    dedent(
        """
        <div class="page-shell">
            <div class="hero-row">
                <div class="hero-bar">
                    <div class="hero-icon">🛡️</div>
                    <div>
                        <p class="hero-title">Vulnerabilities</p>
                        <p class="hero-subtitle">Track, analyze, and prioritize security vulnerabilities</p>
                    </div>
                </div>
            </div>
        </div>
        """
    ).strip(),
    unsafe_allow_html=True,
)

if df.empty:
    total_vulns = critical_count = high_count = medium_low_count = 0
else:
    total_vulns = len(df)
    critical_count = int((df["severity"] == "CRITICAL").sum())
    high_count = int((df["severity"] == "HIGH").sum())
    medium_low_count = int(df["severity"].isin(["MEDIUM", "LOW"]).sum())

kpi_cols = st.columns(4)
with kpi_cols[0]:
    render_metric_card("🐞", "Total Vulnerabilities", total_vulns, "indigo")
with kpi_cols[1]:
    render_metric_card("🚨", "Critical", critical_count, "red")
with kpi_cols[2]:
    render_metric_card("⚠️", "High", high_count, "orange")
with kpi_cols[3]:
    render_metric_card("🟡", "Medium / Low", medium_low_count, "gold")

filter_bar = st.columns([1.3, 0.85, 0.85, 0.9, 0.8, 0.9])
search_term = filter_bar[0].text_input("Search", placeholder="Search CVE or title", label_visibility="collapsed")
severity_filter = filter_bar[1].selectbox("Severity", ["All"] + SEVERITY_ORDER, label_visibility="collapsed")
status_filter = filter_bar[2].selectbox("Status", ["All", "Open", "In Progress", "Fixed"], label_visibility="collapsed")
asset_filter = filter_bar[3].selectbox(
    "Asset",
    ["All"] + sorted(df["asset_name"].unique().tolist()) if not df.empty else ["All"],
    label_visibility="collapsed",
)
time_filter = filter_bar[4].selectbox("Time", ["Last 7 Days", "Last 30 Days", "All Time"], index=1, label_visibility="collapsed")

filtered = df.copy()
if not filtered.empty:
    if search_term.strip():
        q = search_term.strip().lower()
        filtered = filtered[
            filtered["cve"].str.lower().str.contains(q)
            | filtered["title"].str.lower().str.contains(q)
            | filtered["asset_name"].str.lower().str.contains(q)
        ]
    if severity_filter != "All":
        filtered = filtered[filtered["severity"] == severity_filter]
    if status_filter != "All":
        filtered = filtered[filtered["status"] == status_filter]
    if asset_filter != "All":
        filtered = filtered[filtered["asset_name"] == asset_filter]
    if time_filter != "All Time":
        days = 7 if time_filter == "Last 7 Days" else 30
        cutoff = pd.Timestamp.now().tz_localize(None) - pd.Timedelta(days=days)
        filtered = filtered[filtered["detected_at"] >= cutoff]

with filter_bar[5]:
    export_df = filtered.copy()
    if not export_df.empty:
        export_df["detected_at"] = export_df["detected_at"].astype(str)
    st.download_button(
        "Export CSV",
        data=export_df.to_csv(index=False) if not export_df.empty else "cve,title\n",
        file_name="crisp_vulnerabilities.csv",
        mime="text/csv",
        use_container_width=True,
    )

if not filtered.empty:
    filtered["detected_label"] = filtered["detected_at"].apply(time_ago)

kev_sync_col1, kev_sync_col2 = st.columns([1, 3])
with kev_sync_col1:
    if st.button("Sync CISA KEV", use_container_width=True):
        updated = mark_vulnerabilities_known_exploited_from_cves(kev_cves)
        st.success(f"KEV sync complete. Updated {updated} vulnerability record(s).")
with kev_sync_col2:
    st.caption(f"CISA KEV catalog loaded: {len(kev_cves)} exploited CVEs.")

controls_row = st.columns(2)
with controls_row[0]:
    with st.expander("🌐 Search and Import from NVD", expanded=False):
        c1, c2 = st.columns([2, 1])
        keyword = c1.text_input("Keyword search", placeholder="e.g., jira, gitlab, openssl")
        max_results = c2.selectbox("Max results", [10, 20, 50], index=1)

        if st.button("Search NVD", use_container_width=True):
            if not keyword.strip():
                st.warning("Type a keyword first.")
            else:
                with st.spinner("Searching NVD..."):
                    st.session_state["nvd_results"] = cached_search(keyword.strip(), api_key, max_results)

        results = st.session_state["nvd_results"]
        if not results:
            st.info("Search NVD to see results here.")
        else:
            df_nvd = pd.DataFrame(
                [
                    {
                        "cve": r.cve_id,
                        "cvss": "" if r.cvss is None else r.cvss,
                        "published": r.published or "",
                        "summary": (r.description[:150] + "…") if r.description else "",
                    }
                    for r in results
                ]
            )
            st.dataframe(df_nvd, use_container_width=True, hide_index=True)

            view_id = st.selectbox("Select a CVE to view", options=[r.cve_id for r in results], key="nvd_view_id")
            details = get_cve_by_id(view_id, api_key)
            if details:
                st.markdown(f"**{details.cve_id}**")
                st.write(details.description or "No description.")
                st.caption(f"Published: {details.published or 'N/A'} | Last Modified: {details.last_modified or 'N/A'}")

            selected_cves = st.multiselect(
                "Select CVEs to import",
                options=[r.cve_id for r in results],
                default=[results[0].cve_id] if results else [],
            )
            assets_now = list_assets()
            asset_options = [(a.id, a.name) for a in assets_now if a.id is not None]

            if asset_options:
                asset_pick = st.selectbox("Import into asset", options=asset_options, format_func=lambda x: x[1])
                col_a, col_b, col_c = st.columns(3)
                avoid_dupes = col_a.checkbox("Skip duplicates", value=True)
                set_known_exploited = col_b.checkbox("Mark as Known Exploited", value=False)
                default_cvss = col_c.number_input("Default CVSS if missing", min_value=0.0, max_value=10.0, value=5.0, step=0.1)
                source_tag = st.text_input("Title prefix / source tag", value="[NVD]")

                if st.button("Import selected CVEs", use_container_width=True):
                    if not selected_cves:
                        st.warning("Select at least one CVE.")
                    else:
                        existing = set()
                        if avoid_dupes:
                            for vv in list_vulnerabilities():
                                if vv.asset_id == int(asset_pick[0]):
                                    existing.add(vv.cve.strip().upper())

                        imported, skipped = 0, 0
                        for cve_id in selected_cves:
                            chosen = next((r for r in results if r.cve_id == cve_id), None)
                            if not chosen:
                                skipped += 1
                                continue
                            norm = chosen.cve_id.strip().upper()
                            if avoid_dupes and norm in existing:
                                skipped += 1
                                continue
                            base_title = chosen.description.strip() if chosen.description else "Imported from NVD"
                            title = f"{source_tag} {base_title[:120].replace(chr(10), ' ')}".strip()
                            add_vulnerability(
                                Vulnerability(
                                    asset_id=int(asset_pick[0]),
                                    cve=chosen.cve_id,
                                    title=title,
                                    cvss=float(chosen.cvss) if chosen.cvss is not None else float(default_cvss),
                                    known_exploited=bool(set_known_exploited),
                                )
                            )
                            imported += 1
                        st.success(f"Imported {imported} CVE(s)." + (f" Skipped {skipped}." if skipped else ""))
            else:
                st.warning("No assets available. Add assets first in the Assets page.")

with controls_row[1]:
    with st.expander("⚙️ Manual Entry and Alert Actions", expanded=False):
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

                submitted = st.form_submit_button("Add Vulnerability", use_container_width=True)
                if submitted:
                    if not cve.strip() or not title.strip():
                        st.error("CVE and Title are required.")
                    else:
                        new_id = add_vulnerability(
                            Vulnerability(
                                asset_id=int(asset_choice[0]),
                                cve=cve.strip(),
                                title=title.strip(),
                                cvss=float(cvss),
                                known_exploited=bool(known_exploited),
                            )
                        )
                        st.success(f"Vulnerability added (id={new_id}).")

        c1, c2, c3 = st.columns(3)
        if c1.button("Generate alerts from vulnerabilities", use_container_width=True):
            generate_alerts_from_vulns(limit=500)
            st.success("Alerts generated from current vulnerabilities.")
        if c2.button("Export alerts as SIEM JSON", use_container_width=True):
            out_path = export_alerts_json()
            st.success(f"Exported: {out_path}")
        c3.metric("Alerts in DB", len(list_alerts(limit=500)))

trend_df = filtered.copy()
if not trend_df.empty:
    trend_df["date"] = trend_df["detected_at"].dt.floor("D")
    date_index = pd.date_range(trend_df["date"].min(), trend_df["date"].max(), freq="D")
    trend_counts = (
        trend_df.groupby("date")
        .size()
        .reindex(date_index, fill_value=0)
        .rename_axis("date")
        .reset_index(name="count")
    )
    trend_counts["label"] = trend_counts["date"].dt.strftime("%b %d")
else:
    trend_counts = pd.DataFrame({"date": [], "count": [], "label": []})

severity_counts = (
    filtered["severity"].value_counts().reindex(SEVERITY_ORDER, fill_value=0).reset_index()
    if not filtered.empty
    else pd.DataFrame({"index": SEVERITY_ORDER, "severity": [0, 0, 0, 0]})
)
severity_counts.columns = ["severity", "count"]
total_count = max(int(severity_counts["count"].sum()), 1)
severity_counts["pct_text"] = ((severity_counts["count"] / total_count) * 100).round().astype(int).astype(str) + "%"

top_assets = (
    filtered.groupby("asset_name")
    .agg(vuln_count=("cve", "count"), top_severity=("severity", lambda s: sorted(s, key=lambda x: SEVERITY_ORDER.index(x))[0]))
    .reset_index()
    .sort_values(["vuln_count", "asset_name"], ascending=[False, True])
    .head(5)
    if not filtered.empty
    else pd.DataFrame(columns=["asset_name", "vuln_count", "top_severity"])
)

row_one = st.columns([1.25, 1])
with row_one[0]:
    st.markdown('<div class="panel"><div class="panel-title">Vulnerabilities Over Time</div>', unsafe_allow_html=True)
    if trend_counts.empty:
        st.info("No vulnerability trend data available for the selected filters.")
    else:
        st.altair_chart(build_vuln_trend_chart(trend_counts), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

with row_one[1]:
    st.markdown('<div class="panel"><div class="panel-title">Severity Distribution</div>', unsafe_allow_html=True)
    if severity_counts["count"].sum() == 0:
        st.info("No severity distribution available for the selected filters.")
    else:
        pie_col, legend_col = st.columns([1.15, 0.95])
        with pie_col:
            st.altair_chart(build_severity_pie(severity_counts), use_container_width=True)
        with legend_col:
            render_severity_legend(severity_counts)
    st.markdown("</div>", unsafe_allow_html=True)

row_two = st.columns([1, 1])
with row_two[0]:
    st.markdown('<div class="panel"><div class="panel-title">Top Affected Assets</div>', unsafe_allow_html=True)
    render_top_assets_list(top_assets)
    st.markdown("</div>", unsafe_allow_html=True)

with row_two[1]:
    st.markdown('<div class="panel"><div class="panel-title">Summary</div>', unsafe_allow_html=True)
    summary_cols = st.columns(2)
    summary_cols[0].metric("Filtered Results", len(filtered))
    summary_cols[1].metric("Alerts in DB", len(list_alerts(limit=500)))
    st.caption("Severity colors and risk scoring remain aligned with the CRISP dark theme.")
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown('<div class="panel"><div class="panel-title">Vulnerability Details</div>', unsafe_allow_html=True)
render_vuln_table(filtered)
st.markdown("</div>", unsafe_allow_html=True)
