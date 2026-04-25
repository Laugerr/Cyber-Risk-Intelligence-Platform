import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import altair as alt
import pandas as pd
import streamlit as st

from core.reporting import generate_exec_html_report
from core.storage import init_db, list_alerts, list_assets, list_vulnerabilities


st.set_page_config(page_title="CRISP", layout="wide")
init_db()

assets = list_assets()
vulns = list_vulnerabilities()
alerts = list_alerts(limit=2000)
alerts_df = pd.DataFrame([a.model_dump() for a in alerts]) if alerts else pd.DataFrame()
SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        .stApp {
            background:
                radial-gradient(circle at top left, rgba(25, 116, 210, 0.18), transparent 28%),
                radial-gradient(circle at top right, rgba(255, 66, 113, 0.12), transparent 24%),
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

        .block-container > div:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
        }

        .dashboard-shell {
            border: 1px solid rgba(153, 169, 255, 0.16);
            border-radius: 22px;
            padding: 1rem 1.15rem;
            background: linear-gradient(180deg, rgba(13, 18, 40, 0.96), rgba(7, 10, 24, 0.97));
            box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
            margin-bottom: 1.35rem;
        }

        .hero-bar {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.8rem 0.95rem;
            border-radius: 18px;
            background: linear-gradient(90deg, rgba(22, 28, 58, 0.96), rgba(18, 22, 45, 0.88));
            border: 1px solid rgba(122, 138, 214, 0.14);
            margin-bottom: 0;
        }

        .hero-icon {
            width: 28px;
            height: 28px;
            border-radius: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 136, 255, 0.12);
            color: #2da9ff;
            font-size: 1rem;
            border: 1px solid rgba(48, 146, 255, 0.25);
        }

        .hero-title {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: 0.01em;
            margin: 0;
            color: #f7f8ff;
        }

        .hero-subtitle {
            margin: 0.12rem 0 0;
            color: #95a0cb;
            font-size: 0.9rem;
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

        .metric-card.crimson {
            background: linear-gradient(135deg, rgba(120, 38, 52, 0.96), rgba(87, 18, 28, 0.9));
        }

        .metric-label {
            display: flex;
            align-items: center;
            gap: 0.7rem;
            color: #d8e2ff;
            font-size: 0.95rem;
            line-height: 1.2;
            opacity: 0.96;
        }

        .metric-icon {
            font-size: 1.3rem;
            filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.08));
        }

        .metric-value {
            margin-top: 0.6rem;
            font-size: 1.95rem;
            font-weight: 800;
            letter-spacing: 0.02em;
            color: #ffffff;
        }

        .control-strip {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            margin: 0.8rem 0 1rem;
            flex-wrap: wrap;
        }

        .panel {
            border: 1px solid rgba(130, 149, 232, 0.12);
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(21, 26, 53, 0.82), rgba(12, 16, 34, 0.9));
            padding: 0.9rem 1rem 0.5rem;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
            height: 100%;
            margin-top: 0.4rem;
            margin-bottom: 0.9rem;
        }

        .panel-title {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            font-size: 0.95rem;
            font-weight: 700;
            color: #ecf1ff;
            margin-bottom: 0.25rem;
        }

        .panel-title::before {
            content: "";
            width: 3px;
            height: 20px;
            border-radius: 999px;
            background: linear-gradient(180deg, #2ca7ff, #304dff);
            box-shadow: 0 0 20px rgba(56, 143, 255, 0.5);
        }

        .severity-legend {
            display: flex;
            flex-direction: column;
            gap: 0.7rem;
            justify-content: center;
            height: 100%;
            padding-left: 0.4rem;
        }

        .severity-item {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            color: #e4e9ff;
            font-size: 0.95rem;
        }

        .severity-swatch {
            width: 13px;
            height: 13px;
            border-radius: 3px;
        }

        div[data-baseweb="select"] > div,
        div[data-baseweb="select"] div[role="button"] {
            background: rgba(16, 20, 39, 0.88) !important;
            border-color: rgba(120, 136, 204, 0.2) !important;
            color: #eef2ff !important;
            border-radius: 10px !important;
        }

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
            min-height: 2.2rem !important;
        }

        div[data-testid="stDataFrame"] [role="gridcell"] {
            background: rgba(19, 25, 49, 0.92) !important;
            color: #eef2ff !important;
            border-color: rgba(130, 149, 232, 0.08) !important;
            min-height: 2.05rem !important;
            padding-top: 0.3rem !important;
            padding-bottom: 0.3rem !important;
        }

        div[data-testid="stDataFrame"] [role="row"]:hover [role="gridcell"] {
            background: rgba(28, 37, 70, 0.95) !important;
        }

        div[data-testid="stDataFrame"] [role="rowheader"] {
            background: rgba(23, 31, 59, 0.94) !important;
            color: #79b8ff !important;
            border-right: 1px solid rgba(130, 149, 232, 0.1) !important;
        }

        div[data-testid="stDataFrame"] [data-testid="StyledDataFrameCell"]:nth-child(3),
        div[data-testid="stDataFrame"] [role="gridcell"]:last-child {
            color: #ffcad6 !important;
            font-weight: 700 !important;
        }

        div[data-testid="stHorizontalBlock"] {
            gap: 1rem;
            margin-bottom: 0.9rem;
        }

        div[data-testid="stVerticalBlock"] > div:has(> div > div > .panel) {
            margin-bottom: 0.45rem;
        }

        .stSelectbox {
            margin-top: 0.15rem;
            margin-bottom: 1.15rem;
        }

        .stDownloadButton {
            margin-top: 0.15rem;
            margin-bottom: 1.15rem;
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


def render_top_assets_table(df: pd.DataFrame) -> None:
    if df.empty:
        st.info("No alert-driven asset risk data available yet.")
        return

    table_df = df.copy().reset_index(drop=True)
    table_df.insert(0, "Rank", range(1, len(table_df) + 1))
    table_df["risk_score"] = table_df["risk_score"].round(2)
    table_df = table_df.rename(columns={"asset_name": "Asset", "risk_score": "Risk Score"})

    st.dataframe(
        table_df[["Rank", "Asset", "Risk Score"]],
        use_container_width=True,
        height=330,
        hide_index=True,
        column_config={
            "Rank": st.column_config.NumberColumn("Rank", width="small"),
            "Asset": st.column_config.TextColumn("Asset", width="medium"),
            "Risk Score": st.column_config.NumberColumn("Risk Score", format="%.2f", width="small"),
        },
    )


def build_line_chart(df: pd.DataFrame) -> alt.Chart:
    return (
        alt.Chart(df)
        .mark_line(point=alt.OverlayMarkDef(filled=True, size=70), strokeWidth=3, color="#42a5ff")
        .encode(
            x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#b5bfec", grid=False, labelAngle=0)),
            y=alt.Y("risk_score:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            tooltip=[alt.Tooltip("label:N", title="Date"), alt.Tooltip("risk_score:Q", title="Risk Score", format=".0f")],
        )
        .properties(height=230)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_alerts_bar_chart(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        range=["#37a2ff", "#ffd33d", "#ff8c1a", "#ff4b5f"],
    )
    return (
        alt.Chart(df)
        .mark_bar(size=20)
        .encode(
            x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#b5bfec", grid=False, labelAngle=0)),
            y=alt.Y("count:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            color=alt.Color("severity:N", scale=color_scale, legend=None),
            tooltip=[
                alt.Tooltip("label:N", title="Date"),
                alt.Tooltip("severity:N", title="Severity"),
                alt.Tooltip("count:Q", title="Alerts"),
            ],
        )
        .properties(height=230)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_severity_donut(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=["CRITICAL", "HIGH", "MEDIUM", "LOW"],
        range=["#ff3b4e", "#ff8a1f", "#ffcf33", "#45abff"],
    )
    base = alt.Chart(df).encode(
        theta=alt.Theta("count:Q"),
        color=alt.Color("severity:N", scale=color_scale, legend=None),
        tooltip=[
            alt.Tooltip("severity:N", title="Severity"),
            alt.Tooltip("count:Q", title="Alerts"),
            alt.Tooltip("pct_text:N", title="Share"),
        ],
    )
    return (
        base.mark_arc(innerRadius=58, outerRadius=104, cornerRadius=8, padAngle=0.035)
        .properties(height=255)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_severity_trend(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        range=["#45abff", "#ffdf40", "#ff8d4e", "#ff5d75"],
    )
    return (
        alt.Chart(df)
        .mark_line(point=alt.OverlayMarkDef(filled=True, size=55), strokeWidth=2.7)
        .encode(
            x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#b5bfec", grid=False, labelAngle=0)),
            y=alt.Y("count:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            color=alt.Color("severity:N", scale=color_scale, legend=None),
            tooltip=[
                alt.Tooltip("label:N", title="Date"),
                alt.Tooltip("severity:N", title="Severity"),
                alt.Tooltip("count:Q", title="Count"),
            ],
        )
        .properties(height=185)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def reshape_severity_counts(df: pd.DataFrame, date_index: pd.DatetimeIndex) -> pd.DataFrame:
    reshaped = (
        df.pivot(index="date", columns="severity", values="count")
        .reindex(index=date_index, columns=SEVERITY_LEVELS, fill_value=0)
        .fillna(0)
        .rename_axis("date")
        .reset_index()
        .melt(id_vars="date", var_name="severity", value_name="count")
    )
    reshaped["label"] = reshaped["date"].dt.strftime("%b %d")
    reshaped["severity"] = pd.Categorical(reshaped["severity"], SEVERITY_LEVELS, ordered=True)
    return reshaped.sort_values(["date", "severity"])


@st.cache_data(show_spinner=False)
def load_report_html(_asset_count: int, _alert_count: int, _vuln_count: int) -> tuple[str, str]:
    report_path = generate_exec_html_report()
    return report_path.name, Path(report_path).read_text(encoding="utf-8")


inject_styles()

st.markdown(
    dedent(
        """
        <div class="dashboard-shell">
            <div class="hero-bar">
                <div class="hero-icon">▤</div>
                <div>
                    <p class="hero-title">CRISP</p>
                    <p class="hero-subtitle">Cyber Risk Intelligence Platform</p>
                </div>
            </div>
        </div>
        """
    ).strip(),
    unsafe_allow_html=True,
)

kpi_cols = st.columns(4)
with kpi_cols[0]:
    render_metric_card("🖥️", "Assets", len(assets), "blue")
with kpi_cols[1]:
    render_metric_card("🐞", "Vulnerabilities", len(vulns), "indigo")
with kpi_cols[2]:
    render_metric_card("🔔", "Alerts", len(alerts_df), "red")
with kpi_cols[3]:
    critical_count = int(alerts_df["severity"].eq("CRITICAL").sum()) if not alerts_df.empty else 0
    render_metric_card("🚨", "Critical Alerts", critical_count, "crimson")

if alerts_df.empty:
    st.info("No alerts found yet. Generate alerts from the Vulnerabilities page to populate this dashboard.")
    st.stop()

alerts_df["created_at"] = pd.to_datetime(alerts_df["created_at"], errors="coerce")
alerts_df = alerts_df.dropna(subset=["created_at"]).copy()
alerts_df["date"] = alerts_df["created_at"].dt.floor("D")

time_labels = {
    "Last 7 Days": 7,
    "Last 30 Days": 30,
    "All Time": None,
}

control_left, control_right = st.columns([1.2, 1])
with control_left:
    selected_range = st.selectbox("Time Range", list(time_labels.keys()), index=1, label_visibility="collapsed")
with control_right:
    report_name, report_html = load_report_html(len(assets), len(alerts), len(vulns))
    st.download_button(
        "▣ Download Executive Report",
        data=report_html,
        file_name=report_name,
        mime="text/html",
        use_container_width=True,
    )

days = time_labels[selected_range]
filtered_df = alerts_df.copy()
if days is not None:
    cutoff = pd.Timestamp.now(tz=None).floor("D") - pd.Timedelta(days=days - 1)
    filtered_df = filtered_df[filtered_df["date"] >= cutoff]

if filtered_df.empty:
    st.warning(f"No alerts found for the selected range: {selected_range}.")
    st.stop()

date_index = (
    pd.date_range(filtered_df["date"].min(), filtered_df["date"].max(), freq="D")
    if days is None
    else pd.date_range(pd.Timestamp.now(tz=None).floor("D") - pd.Timedelta(days=days - 1), pd.Timestamp.now(tz=None).floor("D"), freq="D")
)

daily_risk = (
    filtered_df.groupby("date", as_index=False)["risk_score"].sum()
    .set_index("date")
    .reindex(date_index, fill_value=0)
    .rename_axis("date")
    .reset_index()
)
daily_risk["label"] = daily_risk["date"].dt.strftime("%b %d")

daily_alerts = (
    filtered_df.groupby(["date", "severity"])
    .size()
    .reset_index(name="count")
)
daily_alerts = reshape_severity_counts(daily_alerts, date_index)

severity_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
severity_palette = {
    "CRITICAL": "#ff3b4e",
    "HIGH": "#ff8a1f",
    "MEDIUM": "#ffcf33",
    "LOW": "#45abff",
}

severity_counts = (
    filtered_df["severity"]
    .value_counts()
    .reindex(severity_order, fill_value=0)
    .reset_index()
)
severity_counts.columns = ["severity", "count"]
severity_total = max(int(severity_counts["count"].sum()), 1)
severity_counts["pct_text"] = ((severity_counts["count"] / severity_total) * 100).round().astype(int).astype(str) + "%"

asset_map = {a.id: a.name for a in assets if a.id is not None}
top_assets = (
    filtered_df.groupby("asset_id", as_index=False)["risk_score"].max()
    .sort_values("risk_score", ascending=False)
    .head(10)
)
top_assets["asset_name"] = top_assets["asset_id"].map(asset_map).fillna("Unknown Asset")
top_assets = top_assets[["asset_name", "risk_score"]]

severity_trend = (
    filtered_df.groupby(["date", "severity"])
    .size()
    .reset_index(name="count")
)
severity_trend = reshape_severity_counts(severity_trend, date_index)

row_one = st.columns(2)
with row_one[0]:
    st.markdown('<div class="panel"><div class="panel-title">Risk Score Over Time</div>', unsafe_allow_html=True)
    st.altair_chart(build_line_chart(daily_risk), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

with row_one[1]:
    st.markdown('<div class="panel"><div class="panel-title">Alerts Created Over Time</div>', unsafe_allow_html=True)
    st.altair_chart(build_alerts_bar_chart(daily_alerts), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

row_two = st.columns([1, 1.45])
with row_two[0]:
    st.markdown('<div class="panel"><div class="panel-title">Severity Distribution</div>', unsafe_allow_html=True)
    pie_col, legend_col = st.columns([1.35, 0.9])
    with pie_col:
        st.altair_chart(build_severity_donut(severity_counts), use_container_width=True)
    with legend_col:
        legend_rows = []
        for item in severity_counts.itertuples(index=False):
            legend_rows.append(
                dedent(
                    f"""
                    <div class="severity-item">
                        <span class="severity-swatch" style="background:{severity_palette[item.severity]};"></span>
                        <span>{item.pct_text} {item.severity.title()}</span>
                    </div>
                    """
                ).strip()
            )
        st.markdown(
            dedent(
                f"""
                <div class="severity-legend">{"".join(legend_rows)}</div>
                """
            ).strip(),
            unsafe_allow_html=True,
        )
    st.markdown("</div>", unsafe_allow_html=True)

with row_two[1]:
    st.markdown('<div class="panel"><div class="panel-title">Top 10 Risky Assets</div>', unsafe_allow_html=True)
    render_top_assets_table(top_assets)
    st.markdown("</div>", unsafe_allow_html=True)

st.markdown('<div class="panel"><div class="panel-title">Severity Trend Over Time</div>', unsafe_allow_html=True)
st.altair_chart(build_severity_trend(severity_trend), use_container_width=True)

st.markdown("</div>", unsafe_allow_html=True)
