import sys
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import pandas as pd
import streamlit as st

from core.models import Asset
from core.sample_data import run_seed
from core.storage import add_asset, init_db, list_assets, reset_db


st.set_page_config(page_title="CRISP • Assets", layout="wide")
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

        .block-container > div:first-child {
            margin-top: 0 !important;
            padding-top: 0 !important;
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
            background: rgba(0, 136, 255, 0.12);
            color: #2da9ff;
            font-size: 1rem;
            border: 1px solid rgba(48, 146, 255, 0.25);
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

        .microcopy {
            color: #93a0cb;
            font-size: 0.9rem;
            margin: -0.2rem 0 0.75rem;
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
        .stFileUploader label {
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

        .stButton button:hover,
        .stDownloadButton button:hover,
        div[data-testid="stFormSubmitButton"] button:hover {
            border-color: rgba(89, 168, 255, 0.35);
            color: #ffffff;
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

        div[data-testid="stDataFrame"] [role="row"]:hover [role="gridcell"] {
            background: rgba(28, 37, 70, 0.95) !important;
        }

        div[data-testid="stDataFrame"] [role="rowheader"] {
            background: rgba(23, 31, 59, 0.94) !important;
            color: #79b8ff !important;
            border-right: 1px solid rgba(130, 149, 232, 0.1) !important;
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


inject_styles()

assets = list_assets()
assets_df = pd.DataFrame([a.model_dump() for a in assets]) if assets else pd.DataFrame()

total_assets = len(assets)
internet_exposed_count = int(assets_df["internet_exposed"].sum()) if not assets_df.empty else 0
critical_assets_count = int((assets_df["criticality"] >= 4).sum()) if not assets_df.empty else 0
owner_count = int(assets_df["owner"].nunique()) if not assets_df.empty else 0

st.markdown(
    dedent(
        """
        <div class="page-shell">
            <div class="hero-bar">
                <div class="hero-icon">🗂️</div>
                <div>
                    <p class="hero-title">Asset Inventory</p>
                    <p class="hero-subtitle">Manage enterprise assets, ownership, exposure, and criticality in one place.</p>
                </div>
            </div>
        </div>
        """
    ).strip(),
    unsafe_allow_html=True,
)

kpi_cols = st.columns(4)
with kpi_cols[0]:
    render_metric_card("🖥️", "Assets", total_assets, "blue")
with kpi_cols[1]:
    render_metric_card("🌐", "Internet Exposed", internet_exposed_count, "indigo")
with kpi_cols[2]:
    render_metric_card("⭐", "Critical Assets", critical_assets_count, "red")
with kpi_cols[3]:
    render_metric_card("👥", "Owners", owner_count, "crimson")

with st.expander("🧪 Demo / Dev Controls", expanded=False):
    c1, c2 = st.columns(2)
    if c1.button("🌱 Seed demo data", use_container_width=True):
        run_seed()
        st.success("Seed completed. Reload page if needed.")
    if c2.button("🧨 Reset database (wipe all)", use_container_width=True):
        reset_db()
        st.warning("Database wiped. Seed again to restore demo data.")

form_col, import_col = st.columns([1.15, 1])

with form_col:
    st.markdown('<div class="panel"><div class="panel-title">Add New Asset</div>', unsafe_allow_html=True)
    st.markdown('<p class="microcopy">Capture a new asset manually with owner, exposure, and criticality context.</p>', unsafe_allow_html=True)

    with st.form("add_asset_form", clear_on_submit=True):
        col1, col2 = st.columns(2)
        name = col1.text_input("Asset Name*", placeholder="e.g., HR-Portal")
        asset_type = col2.selectbox(
            "Asset Type",
            ["Server", "Workstation", "Cloud", "Network", "WebApp", "Database", "Other"],
            index=4,
        )

        col3, col4 = st.columns(2)
        owner = col3.text_input("Owner / Department", placeholder="e.g., IT / Finance / HR")
        criticality = col4.slider("Criticality", 1, 5, 3)

        internet_exposed = st.checkbox("Internet Exposed (public-facing)")
        submitted = st.form_submit_button("Add Asset", use_container_width=True)

        if submitted:
            if not name.strip():
                st.error("Asset name is required.")
            else:
                asset = Asset(
                    name=name.strip(),
                    asset_type=asset_type,
                    owner=owner.strip() if owner.strip() else "IT",
                    criticality=int(criticality),
                    internet_exposed=bool(internet_exposed),
                )
                new_id = add_asset(asset)
                st.success(f"Asset added (id={new_id}).")

    st.markdown("</div>", unsafe_allow_html=True)

with import_col:
    st.markdown('<div class="panel"><div class="panel-title">Import Assets (CSV)</div>', unsafe_allow_html=True)
    st.markdown(
        '<p class="microcopy">CSV columns: <code>name</code>, <code>asset_type</code>, <code>owner</code>, <code>criticality</code>, <code>internet_exposed</code>.</p>',
        unsafe_allow_html=True,
    )

    uploaded = st.file_uploader("Upload asset CSV", type=["csv"], label_visibility="collapsed")
    if uploaded is not None:
        try:
            df = pd.read_csv(uploaded)
            required_cols = {"name", "asset_type", "owner", "criticality", "internet_exposed"}
            if not required_cols.issubset(set(df.columns)):
                st.error(f"CSV missing required columns. Needed: {sorted(required_cols)}")
            else:
                st.dataframe(df.head(8), use_container_width=True, height=290, hide_index=True)
                if st.button("Import CSV", use_container_width=True):
                    imported = 0
                    for _, row in df.iterrows():
                        asset = Asset(
                            name=str(row["name"]).strip(),
                            asset_type=str(row["asset_type"]).strip() or "Other",
                            owner=str(row["owner"]).strip() or "IT",
                            criticality=int(row["criticality"]),
                            internet_exposed=bool(int(row["internet_exposed"])),
                        )
                        add_asset(asset)
                        imported += 1
                    st.success(f"Imported {imported} assets.")
        except Exception as e:
            st.error(f"Failed to import CSV: {e}")
    else:
        st.info("Upload a CSV file to preview and import assets in bulk.")

    st.markdown("</div>", unsafe_allow_html=True)

st.markdown('<div class="panel"><div class="panel-title">Current Assets</div>', unsafe_allow_html=True)
st.markdown('<p class="microcopy">Filter the inventory by owner, type, and exposure to review your current enterprise footprint.</p>', unsafe_allow_html=True)

assets = list_assets()
if not assets:
    st.info("No assets yet. Add one above or seed demo data.")
else:
    df_assets = pd.DataFrame([a.model_dump() for a in assets])
    df_assets["created_at"] = pd.to_datetime(df_assets["created_at"], errors="coerce").dt.strftime("%Y-%m-%d %H:%M")

    f1, f2, f3 = st.columns(3)
    owners = ["All"] + sorted(df_assets["owner"].dropna().unique().tolist())
    types = ["All"] + sorted(df_assets["asset_type"].dropna().unique().tolist())

    owner_filter = f1.selectbox("Filter by Owner", owners, index=0)
    type_filter = f2.selectbox("Filter by Type", types, index=0)
    exposed_filter = f3.selectbox("Filter by Exposure", ["All", "Internet Exposed", "Internal"], index=0)

    filtered = df_assets.copy()
    if owner_filter != "All":
        filtered = filtered[filtered["owner"] == owner_filter]
    if type_filter != "All":
        filtered = filtered[filtered["asset_type"] == type_filter]
    if exposed_filter == "Internet Exposed":
        filtered = filtered[filtered["internet_exposed"] == True]
    elif exposed_filter == "Internal":
        filtered = filtered[filtered["internet_exposed"] == False]

    filtered = filtered.rename(
        columns={
            "id": "ID",
            "name": "Asset",
            "asset_type": "Type",
            "owner": "Owner",
            "criticality": "Criticality",
            "internet_exposed": "Internet Exposed",
            "created_at": "Created At",
        }
    )

    st.dataframe(
        filtered[["ID", "Asset", "Type", "Owner", "Criticality", "Internet Exposed", "Created At"]],
        use_container_width=True,
        hide_index=True,
        height=380,
        column_config={
            "ID": st.column_config.NumberColumn("ID", width="small"),
            "Asset": st.column_config.TextColumn("Asset", width="medium"),
            "Type": st.column_config.TextColumn("Type", width="small"),
            "Owner": st.column_config.TextColumn("Owner", width="medium"),
            "Criticality": st.column_config.NumberColumn("Criticality", width="small"),
            "Internet Exposed": st.column_config.CheckboxColumn("Internet Exposed", width="small"),
            "Created At": st.column_config.TextColumn("Created At", width="medium"),
        },
    )

st.markdown("</div>", unsafe_allow_html=True)
