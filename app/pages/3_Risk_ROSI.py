import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import altair as alt
import pandas as pd
import streamlit as st

from core.rosi import calculate_rosi, estimate_ale
from core.storage import init_db, list_alerts, list_controls


st.set_page_config(page_title="CRISP • Risk & ROSI", layout="wide")
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

        .hero-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
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
            background: rgba(255, 202, 82, 0.12);
            color: #ffd978;
            font-size: 1rem;
            border: 1px solid rgba(255, 210, 108, 0.25);
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

        .metric-card.blue {
            background: linear-gradient(135deg, rgba(27, 57, 112, 0.92), rgba(17, 35, 74, 0.84));
        }

        .metric-card.indigo {
            background: linear-gradient(135deg, rgba(42, 39, 108, 0.94), rgba(24, 20, 76, 0.84));
        }

        .metric-card.green {
            background: linear-gradient(135deg, rgba(35, 81, 54, 0.94), rgba(15, 54, 33, 0.88));
        }

        .metric-card.red {
            background: linear-gradient(135deg, rgba(103, 29, 73, 0.96), rgba(85, 17, 42, 0.86));
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
            background: linear-gradient(180deg, #f8b94b, #ff6f61);
            box-shadow: 0 0 18px rgba(255, 160, 87, 0.35);
        }

        .mini-stat {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            padding: 0.7rem 0.8rem;
            border-radius: 12px;
            background: rgba(20, 26, 51, 0.88);
            border: 1px solid rgba(130, 149, 232, 0.1);
            margin-bottom: 0.6rem;
        }

        .mini-label {
            color: #dbe4ff;
            font-size: 0.95rem;
        }

        .mini-value {
            color: #ffffff;
            font-weight: 800;
            font-size: 1.05rem;
        }

        .rosi-pill {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0.22rem 0.65rem;
            border-radius: 999px;
            font-weight: 700;
            background: rgba(89, 207, 126, 0.14);
            border: 1px solid rgba(89, 207, 126, 0.18);
            color: #86efac;
        }

        .rosi-pill.negative {
            background: rgba(255, 102, 124, 0.12);
            border-color: rgba(255, 102, 124, 0.18);
            color: #ff9aaa;
        }

        div[data-baseweb="select"] > div,
        div[data-baseweb="select"] div[role="button"] {
            background: rgba(16, 20, 39, 0.88) !important;
            border-color: rgba(120, 136, 204, 0.2) !important;
            color: #eef2ff !important;
            border-radius: 10px !important;
        }

        .stAlert {
            background: rgba(18, 24, 48, 0.86);
            border: 1px solid rgba(126, 143, 214, 0.16);
            color: #edf2ff;
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


def build_exposure_chart(df: pd.DataFrame) -> alt.Chart:
    base = alt.Chart(df).encode(
        x=alt.X("label:N", sort=None, axis=alt.Axis(title=None, labelColor="#b5bfec", grid=False, labelAngle=0))
    )
    potential = base.mark_line(point=alt.OverlayMarkDef(filled=True, size=55), strokeWidth=2.8, color="#ff5b61").encode(
        y=alt.Y("potential_loss:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
        tooltip=[alt.Tooltip("label:N", title="Date"), alt.Tooltip("potential_loss:Q", title="Potential Loss", format=",.0f")],
    )
    mitigated = base.mark_line(point=alt.OverlayMarkDef(filled=True, size=50), strokeWidth=2.5, color="#7cd992").encode(
        y="mitigated_loss:Q",
        tooltip=[alt.Tooltip("label:N", title="Date"), alt.Tooltip("mitigated_loss:Q", title="Mitigated Loss", format=",.0f")],
    )
    residual = base.mark_line(point=alt.OverlayMarkDef(filled=True, size=45), strokeWidth=2.2, color="#ffd45a").encode(
        y="residual_loss:Q",
        tooltip=[alt.Tooltip("label:N", title="Date"), alt.Tooltip("residual_loss:Q", title="Residual Loss", format=",.0f")],
    )
    return (
        alt.layer(potential, mitigated, residual)
        .properties(height=240)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


def build_cost_benefit_chart(df: pd.DataFrame) -> alt.Chart:
    color_scale = alt.Scale(
        domain=["Mitigated Loss", "Mitigation Costs", "Residual Exposure"],
        range=["#65d38b", "#ffd45a", "#3d4c75"],
    )
    return (
        alt.Chart(df)
        .mark_arc(innerRadius=55, outerRadius=105, cornerRadius=8, padAngle=0.025)
        .encode(
            theta=alt.Theta("value:Q"),
            color=alt.Color("category:N", scale=color_scale, legend=None),
            tooltip=[
                alt.Tooltip("category:N", title="Category"),
                alt.Tooltip("value:Q", title="Amount", format=",.0f"),
            ],
        )
        .properties(height=245)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )


inject_styles()

alerts = list_alerts(limit=1500)
controls = list_controls()

st.markdown(
    dedent(
        """
        <div class="page-shell">
            <div class="hero-row">
                <div class="hero-bar">
                    <div class="hero-icon">💰</div>
                    <div>
                        <p class="hero-title">Risk Quantification & ROSI</p>
                        <p class="hero-subtitle">Estimate annual loss, compare control costs, and model security investment impact.</p>
                    </div>
                </div>
            </div>
        </div>
        """
    ).strip(),
    unsafe_allow_html=True,
)

if not alerts:
    st.warning("No alerts found. Generate alerts from the Vulnerabilities page first.")
    st.stop()

if not controls:
    st.warning("No controls found. Seed demo data from Assets page.")
    st.stop()

alerts_df = pd.DataFrame([a.model_dump() for a in alerts])
alerts_df["created_at"] = pd.to_datetime(alerts_df["created_at"], errors="coerce")
alerts_df = alerts_df.dropna(subset=["created_at"]).copy()

total_risk_score = float(alerts_df["risk_score"].sum())
ale = estimate_ale(total_risk_score)

control_options = {c.id: c for c in controls if c.id is not None}
control_strip = st.columns([1.2, 0.9])
with control_strip[0]:
    selected_id = st.selectbox(
        "Select Control",
        options=list(control_options.keys()),
        format_func=lambda x: control_options[x].name,
    )
with control_strip[1]:
    st.markdown('<div style="height:0.2rem;"></div>', unsafe_allow_html=True)

control = control_options[selected_id]
risk_reduction_value, rosi = calculate_rosi(
    ale_before=ale,
    control_cost=control.annual_cost_eur,
    effectiveness_pct=control.effectiveness_pct,
)
ale_after = max(ale - risk_reduction_value, 0)

kpi_cols = st.columns(4)
with kpi_cols[0]:
    render_metric_card("📉", "Total Risk Score", f"{total_risk_score:,.2f}", "blue")
with kpi_cols[1]:
    render_metric_card("💸", "Estimated ALE", f"€{ale:,.0f}", "indigo")
with kpi_cols[2]:
    render_metric_card("🛡️", "Mitigated Value", f"€{risk_reduction_value:,.0f}", "green")
with kpi_cols[3]:
    render_metric_card("📊", "ROSI", f"{rosi:+.0%}".replace("%", "%"), "red")

daily_df = alerts_df.copy()
daily_df["date"] = daily_df["created_at"].dt.floor("D")
date_index = pd.date_range(daily_df["date"].min(), daily_df["date"].max(), freq="D")
daily_risk = (
    daily_df.groupby("date")["risk_score"]
    .sum()
    .reindex(date_index, fill_value=0)
    .rename_axis("date")
    .reset_index(name="risk_score")
)
daily_risk["potential_loss"] = daily_risk["risk_score"].apply(estimate_ale)
daily_risk["mitigated_loss"] = daily_risk["potential_loss"] * (control.effectiveness_pct / 100)
daily_risk["residual_loss"] = daily_risk["potential_loss"] - daily_risk["mitigated_loss"]
daily_risk["label"] = daily_risk["date"].dt.strftime("%b %d")

cost_benefit_df = pd.DataFrame(
    [
        {"category": "Mitigated Loss", "value": risk_reduction_value},
        {"category": "Mitigation Costs", "value": control.annual_cost_eur},
        {"category": "Residual Exposure", "value": ale_after},
    ]
)

row_one = st.columns([1.3, 1])
with row_one[0]:
    st.markdown('<div class="panel"><div class="panel-title">Risk Exposure Over Time</div>', unsafe_allow_html=True)
    st.altair_chart(build_exposure_chart(daily_risk), use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

with row_one[1]:
    st.markdown('<div class="panel"><div class="panel-title">Cost-Benefit Breakdown</div>', unsafe_allow_html=True)
    donut_col, stats_col = st.columns([1.1, 0.95])
    with donut_col:
        st.altair_chart(build_cost_benefit_chart(cost_benefit_df), use_container_width=True)
    with stats_col:
        st.markdown(
            f"""
            <div class="mini-stat">
                <div class="mini-label">Mitigated Loss</div>
                <div class="mini-value">€{risk_reduction_value:,.0f}</div>
            </div>
            <div class="mini-stat">
                <div class="mini-label">Mitigation Costs</div>
                <div class="mini-value">€{control.annual_cost_eur:,.0f}</div>
            </div>
            <div class="mini-stat">
                <div class="mini-label">ROSI</div>
                <div class="mini-value"><span class="rosi-pill {'negative' if rosi < 0 else ''}">{rosi:+.0%}</span></div>
            </div>
            """,
            unsafe_allow_html=True,
        )
    st.markdown("</div>", unsafe_allow_html=True)

row_two = st.columns([1, 1])
with row_two[0]:
    st.markdown('<div class="panel"><div class="panel-title">Control Profile</div>', unsafe_allow_html=True)
    st.markdown(
        f"""
        <div class="mini-stat">
            <div class="mini-label">Selected Control</div>
            <div class="mini-value">{control.name}</div>
        </div>
        <div class="mini-stat">
            <div class="mini-label">Annual Cost</div>
            <div class="mini-value">€{control.annual_cost_eur:,.2f}</div>
        </div>
        <div class="mini-stat">
            <div class="mini-label">Effectiveness</div>
            <div class="mini-value">{control.effectiveness_pct}%</div>
        </div>
        """,
        unsafe_allow_html=True,
    )
    st.caption(control.notes or "No additional notes available for this control.")
    st.markdown("</div>", unsafe_allow_html=True)

with row_two[1]:
    st.markdown('<div class="panel"><div class="panel-title">ALE Impact</div>', unsafe_allow_html=True)
    impact_df = pd.DataFrame(
        {"Scenario": ["ALE Before", "ALE After"], "EUR": [ale, ale_after]}
    )
    impact_chart = (
        alt.Chart(impact_df)
        .mark_bar(cornerRadiusTopLeft=6, cornerRadiusTopRight=6)
        .encode(
            x=alt.X("Scenario:N", axis=alt.Axis(title=None, labelColor="#dbe4ff")),
            y=alt.Y("EUR:Q", axis=alt.Axis(title=None, labelColor="#b5bfec", gridColor="rgba(143,158,224,0.16)")),
            color=alt.Color(
                "Scenario:N",
                scale=alt.Scale(domain=["ALE Before", "ALE After"], range=["#ff7a6b", "#72d58e"]),
                legend=None,
            ),
            tooltip=[alt.Tooltip("Scenario:N"), alt.Tooltip("EUR:Q", format=",.0f")],
        )
        .properties(height=240)
        .configure_view(strokeOpacity=0)
        .configure(background="transparent")
    )
    st.altair_chart(impact_chart, use_container_width=True)
    st.markdown("</div>", unsafe_allow_html=True)

if rosi > 0:
    st.success(f"This control is financially justified. Projected savings exceed cost. ROSI = {rosi:+.2f}")
else:
    st.error(f"This control may not be financially justified based on the current model. ROSI = {rosi:+.2f}")
