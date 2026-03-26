import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import altair as alt
import pandas as pd
import streamlit as st

from core.reporting import generate_exec_html_report
from core.storage import export_alerts_json, init_db, list_alerts, list_controls


st.set_page_config(page_title="CRISP • Reports", layout="wide")
init_db()


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
            margin-bottom: 1.2rem;
        }

        .hero-bar {
            display: flex;
            align-items: center;
            gap: 0.85rem;
            padding: 0.9rem 1rem;
            border-radius: 18px;
            background: linear-gradient(90deg, rgba(22, 28, 58, 0.96), rgba(18, 22, 45, 0.88));
            border: 1px solid rgba(122, 138, 214, 0.14);
        }

        .hero-icon {
            width: 30px;
            height: 30px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(126, 177, 255, 0.12);
            color: #7fb7ff;
            font-size: 1rem;
            border: 1px solid rgba(126, 177, 255, 0.24);
        }

        .hero-title {
            font-size: 1.45rem;
            font-weight: 800;
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

        .metric-card.blue {
            background: linear-gradient(135deg, rgba(27, 57, 112, 0.92), rgba(17, 35, 74, 0.84));
        }

        .metric-card.indigo {
            background: linear-gradient(135deg, rgba(42, 39, 108, 0.94), rgba(24, 20, 76, 0.84));
        }

        .metric-card.red {
            background: linear-gradient(135deg, rgba(103, 29, 73, 0.96), rgba(85, 17, 42, 0.86));
        }

        .metric-card.gold {
            background: linear-gradient(135deg, rgba(96, 78, 26, 0.94), rgba(69, 55, 12, 0.88));
        }

        .metric-label {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            color: #d8e2ff;
            font-size: 0.95rem;
        }

        .metric-icon {
            font-size: 1.2rem;
        }

        .metric-value {
            margin-top: 0.6rem;
            font-size: 1.8rem;
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

        .microcopy {
            color: #93a0cb;
            font-size: 0.9rem;
            margin: -0.15rem 0 0.8rem;
        }

        .mini-card {
            padding: 0.9rem 1rem;
            border-radius: 12px;
            background: rgba(18, 24, 48, 0.82);
            border: 1px solid rgba(130, 149, 232, 0.12);
            margin-bottom: 0.75rem;
        }

        .mini-label {
            color: #9fb0e6;
            font-size: 0.84rem;
            margin-bottom: 0.25rem;
        }

        .mini-value {
            color: #f7f9ff;
            font-size: 1.25rem;
            font-weight: 800;
        }

        div[data-baseweb="select"] > div,
        div[data-baseweb="select"] div[role="button"] {
            background: rgba(16, 20, 39, 0.88) !important;
            border-color: rgba(120, 136, 204, 0.2) !important;
            color: #eef2ff !important;
            border-radius: 10px !important;
        }

        .stButton button,
        .stDownloadButton button {
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

        div[data-testid="stDataFrame"] {
            border: 1px solid rgba(130, 149, 232, 0.12);
            border-radius: 14px;
            overflow: hidden;
            background: linear-gradient(180deg, rgba(21, 26, 53, 0.82), rgba(12, 16, 34, 0.9));
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        div[data-testid="stDataFrame"] > div {
            background: linear-gradient(180deg, rgba(21, 26, 53, 0.82), rgba(12, 16, 34, 0.9)) !important;
        }

        div[data-testid="stDataFrame"] [data-testid="StyledDataFrame"],
        div[data-testid="stDataFrame"] [data-testid="StyledDataFrame"] > div,
        div[data-testid="stDataFrame"] [role="grid"],
        div[data-testid="stDataFrame"] [role="table"] {
            background: transparent !important;
        }

        div[data-testid="stDataFrame"] [role="columnheader"] {
            background: rgba(18, 24, 48, 0.98) !important;
            color: #dbe4ff !important;
            border-bottom: 1px solid rgba(130, 149, 232, 0.16) !important;
            font-weight: 700 !important;
        }

        div[data-testid="stDataFrame"] [role="gridcell"] {
            background: rgba(19, 25, 49, 0.92) !important;
            color: #eef2ff !important;
            border-color: rgba(130, 149, 232, 0.08) !important;
        }

        div[data-testid="stHorizontalBlock"] {
            gap: 1rem;
            margin-bottom: 0.9rem;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_metric_card(icon: str, label: str, value: str, tone: str) -> None:
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


def build_severity_chart(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        range=["#ff4f67", "#ff9830", "#ffd24f", "#6ddb8a"],
    )
    return (
        alt.Chart(df)
        .mark_bar(cornerRadiusTopLeft=6, cornerRadiusTopRight=6)
        .encode(
            x=alt.X("severity:N", sort=None, axis=alt.Axis(title=None, labelColor="#dbe4ff")),
            y=alt.Y("count:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            color=alt.Color("severity:N", scale=color_scale, legend=None),
            tooltip=[alt.Tooltip("severity:N"), alt.Tooltip("count:Q")],
        )
        .properties(height=240)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_risk_overview_chart(df: pd.DataFrame) -> alt.Chart:
    base = alt.Chart(df).encode(
        x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#dbe4ff", grid=False, labelAngle=0))
    )
    potential = base.mark_line(point=alt.OverlayMarkDef(filled=True, size=55), strokeWidth=2.8, color="#6db6ff").encode(
        y=alt.Y("potential_loss:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
        tooltip=[alt.Tooltip("label:N", title="Date"), alt.Tooltip("potential_loss:Q", title="Potential Loss", format=",.0f")],
    )
    mitigated = base.mark_line(point=alt.OverlayMarkDef(filled=True, size=45), strokeWidth=2.4, color="#84dc92").encode(
        y="mitigated_loss:Q",
        tooltip=[alt.Tooltip("mitigated_loss:Q", title="Mitigated Loss", format=",.0f")],
    )
    residual = base.mark_line(point=alt.OverlayMarkDef(filled=True, size=45), strokeWidth=2.2, color="#ffd457").encode(
        y="residual_loss:Q",
        tooltip=[alt.Tooltip("residual_loss:Q", title="Residual Loss", format=",.0f")],
    )
    return (
        alt.layer(potential, mitigated, residual)
        .properties(height=225)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_alerts_created_chart(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        range=["#55d187", "#ffd457", "#ff9a33", "#ff536c"],
    )
    return (
        alt.Chart(df)
        .mark_bar(size=18)
        .encode(
            x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#dbe4ff", grid=False, labelAngle=0)),
            y=alt.Y("count:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            color=alt.Color("severity:N", scale=color_scale, legend=None),
            tooltip=[
                alt.Tooltip("label:N", title="Date"),
                alt.Tooltip("severity:N", title="Severity"),
                alt.Tooltip("count:Q", title="Alerts"),
            ],
        )
        .properties(height=225)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


inject_styles()

alerts = list_alerts(limit=2000)
controls = list_controls()

st.markdown(
    dedent(
        """
        <div class="page-shell">
            <div class="hero-bar">
                <div class="hero-icon">📑</div>
                <div>
                    <p class="hero-title">Reports & Exports</p>
                    <p class="hero-subtitle">Package risk intelligence into polished exports, executive summaries, and ready-to-share artifacts.</p>
                </div>
            </div>
        </div>
        """
    ).strip(),
    unsafe_allow_html=True,
)

if alerts:
    df = pd.DataFrame([a.model_dump() for a in alerts])
    df["created_at"] = pd.to_datetime(df["created_at"], errors="coerce")
    sev_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    sev_counts = df["severity"].value_counts().reindex(sev_order).fillna(0).astype(int)
else:
    df = pd.DataFrame()
    sev_counts = pd.Series([0, 0, 0, 0], index=["CRITICAL", "HIGH", "MEDIUM", "LOW"])

kpi_cols = st.columns(4)
with kpi_cols[0]:
    render_metric_card("🔔", "Total Alerts", f"{len(df):,}", "blue")
with kpi_cols[1]:
    render_metric_card("🚨", "Critical", f"{int(sev_counts.get('CRITICAL', 0)):,}", "red")
with kpi_cols[2]:
    render_metric_card("🟠", "High", f"{int(sev_counts.get('HIGH', 0)):,}", "indigo")
with kpi_cols[3]:
    render_metric_card("🟡", "Medium", f"{int(sev_counts.get('MEDIUM', 0)):,}", "gold")

if not df.empty:
    trend_df = df.dropna(subset=["created_at"]).copy()
    trend_df["date"] = trend_df["created_at"].dt.floor("D")
    date_index = pd.date_range(trend_df["date"].min(), trend_df["date"].max(), freq="D")
    daily_risk = (
        trend_df.groupby("date")["risk_score"]
        .sum()
        .reindex(date_index, fill_value=0)
        .rename_axis("date")
        .reset_index(name="risk_score")
    )
    daily_risk["potential_loss"] = daily_risk["risk_score"] * 10000
    daily_risk["mitigated_loss"] = daily_risk["potential_loss"] * 0.4
    daily_risk["residual_loss"] = daily_risk["potential_loss"] - daily_risk["mitigated_loss"]
    daily_risk["label"] = daily_risk["date"].dt.strftime("%b %d")

    daily_alerts = (
        trend_df.groupby(["date", "severity"])
        .size()
        .reset_index(name="count")
        .pivot(index="date", columns="severity", values="count")
        .reindex(index=date_index, columns=["LOW", "MEDIUM", "HIGH", "CRITICAL"], fill_value=0)
        .rename_axis("date")
        .reset_index()
        .melt(id_vars="date", var_name="severity", value_name="count")
    )
    daily_alerts["label"] = daily_alerts["date"].dt.strftime("%b %d")
else:
    daily_risk = pd.DataFrame(columns=["date", "risk_score", "potential_loss", "mitigated_loss", "residual_loss", "label"])
    daily_alerts = pd.DataFrame(columns=["date", "severity", "count", "label"])

overview_row = st.columns([1.15, 0.85])
with overview_row[0]:
    st.markdown('<div class="panel"><div class="panel-title">Risk Overview</div>', unsafe_allow_html=True)
    if daily_risk.empty:
        st.info("No alert trend data available yet.")
    else:
        st.altair_chart(build_risk_overview_chart(daily_risk), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

with overview_row[1]:
    st.markdown('<div class="panel"><div class="panel-title">Alerts Created Over Time</div>', unsafe_allow_html=True)
    if daily_alerts.empty:
        st.info("No alert creation data available yet.")
    else:
        st.altair_chart(build_alerts_created_chart(daily_alerts), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

row_one = st.columns([1.05, 0.95])
with row_one[0]:
    st.markdown('<div class="panel"><div class="panel-title">Snapshot</div>', unsafe_allow_html=True)
    st.markdown('<p class="microcopy">A quick read on the current alert landscape before exporting or packaging reports.</p>', unsafe_allow_html=True)
    if df.empty:
        st.info("No alerts yet. Go to the Vulnerabilities page and generate alerts first.")
    else:
        chart_df = sev_counts.reset_index()
        chart_df.columns = ["severity", "count"]
        st.altair_chart(build_severity_chart(chart_df), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

with row_one[1]:
    st.markdown('<div class="panel"><div class="panel-title">Export Studio</div>', unsafe_allow_html=True)
    st.markdown('<p class="microcopy">Generate machine-readable exports and executive-ready HTML reports from the same live dataset.</p>', unsafe_allow_html=True)

    controls_map = {c.id: c.name for c in controls if c.id is not None}
    selected_control = None
    if controls_map:
        selected_control = st.selectbox(
            "Select control for executive report",
            options=list(controls_map.keys()),
            format_func=lambda x: controls_map[x],
        )
    else:
        st.warning("No controls found. Seed demo data from the Assets page if needed.")

    export_col, report_col = st.columns(2)
    with export_col:
        if st.button("Generate Alerts JSON", use_container_width=True):
            out = export_alerts_json()
            st.session_state["alerts_json_path"] = str(out)
            st.success(f"Exported: {out.name}")
        json_path = st.session_state.get("alerts_json_path")
        if json_path:
            json_text = Path(json_path).read_text(encoding="utf-8")
            st.download_button(
                "Download JSON",
                data=json_text,
                file_name=Path(json_path).name,
                mime="application/json",
                use_container_width=True,
            )

    with report_col:
        if st.button("Generate Executive Report", use_container_width=True):
            report_path = generate_exec_html_report(selected_control_id=selected_control)
            st.session_state["report_html_path"] = str(report_path)
            st.success(f"Report ready: {report_path.name}")
        report_html_path = st.session_state.get("report_html_path")
        if report_html_path:
            html = Path(report_html_path).read_text(encoding="utf-8")
            st.download_button(
                "Download HTML",
                data=html,
                file_name=Path(report_html_path).name,
                mime="text/html",
                use_container_width=True,
            )

    st.markdown("</div>", unsafe_allow_html=True)

row_two = st.columns([1.05, 0.95])
with row_two[0]:
    st.markdown('<div class="panel"><div class="panel-title">Top Alert Entries</div>', unsafe_allow_html=True)
    st.markdown('<p class="microcopy">The highest-priority alerts likely to appear in exported materials and executive summaries.</p>', unsafe_allow_html=True)
    if df.empty:
        st.info("No alert data available yet.")
    else:
        top = df.sort_values(by="risk_score", ascending=False).head(10)
        st.dataframe(
            top[["severity", "risk_score", "title", "cve", "created_at"]],
            use_container_width=True,
            hide_index=True,
            height=350,
            column_config={
                "risk_score": st.column_config.NumberColumn("risk_score", format="%.2f"),
            },
        )
    st.markdown("</div>", unsafe_allow_html=True)

with row_two[1]:
    st.markdown('<div class="panel"><div class="panel-title">Publishing Notes</div>', unsafe_allow_html=True)
    st.markdown(
        """
        <div class="mini-card">
            <div class="mini-label">Recommended Workflow</div>
            <div class="mini-value">Review → Export JSON → Generate Executive HTML</div>
        </div>
        <div class="mini-card">
            <div class="mini-label">Best Use</div>
            <div class="mini-value">Share with SOC teams, leadership, and portfolio reviewers</div>
        </div>
        <div class="mini-card">
            <div class="mini-label">Preview Mode</div>
            <div class="mini-value">Inline HTML rendering for quick quality checks</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("</div>", unsafe_allow_html=True)

report_html_path = st.session_state.get("report_html_path")
if report_html_path:
    st.markdown('<div class="panel"><div class="panel-title">Executive Report Preview</div>', unsafe_allow_html=True)
    html = Path(report_html_path).read_text(encoding="utf-8")
    st.components.v1.html(html, height=760, scrolling=True)
    st.markdown("</div>", unsafe_allow_html=True)
else:
    st.markdown('<div class="panel"><div class="panel-title">Executive Report Preview</div>', unsafe_allow_html=True)
    st.info("Generate an executive report to preview it here.")
    st.markdown("</div>", unsafe_allow_html=True)
