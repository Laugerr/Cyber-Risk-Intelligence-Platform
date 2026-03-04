import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import streamlit as st
import pandas as pd

from core.models import Asset
from core.storage import init_db, add_asset, list_assets, reset_db
from core.sample_data import run_seed


st.set_page_config(page_title="CRISP • Assets", layout="wide")
init_db()

st.title("🗂️ Asset Inventory")
st.caption("Add assets, import assets, and manage your simulated enterprise inventory.")

# --- Demo controls ---
with st.expander("🧪 Demo / Dev Controls", expanded=False):
    c1, c2 = st.columns(2)

    if c1.button("🌱 Seed demo data"):
        run_seed()
        st.success("Seed completed. Reload page if needed.")

    if c2.button("🧨 Reset database (wipe all)"):
        reset_db()
        st.warning("Database wiped. Seed again to restore demo data.")


st.divider()

# --- Add Asset Form ---
st.subheader("➕ Add New Asset")

with st.form("add_asset_form", clear_on_submit=True):
    col1, col2, col3 = st.columns(3)

    name = col1.text_input("Asset Name*", placeholder="e.g., HR-Portal")
    asset_type = col2.selectbox(
        "Asset Type",
        ["Server", "Workstation", "Cloud", "Network", "WebApp", "Database", "Other"],
        index=4,
    )
    owner = col3.text_input("Owner / Department", placeholder="e.g., IT / Finance / HR")

    col4, col5 = st.columns(2)
    criticality = col4.slider("Criticality (1 low → 5 mission critical)", 1, 5, 3)
    internet_exposed = col5.checkbox("Internet Exposed (public-facing)")

    submitted = st.form_submit_button("Add Asset ✅")

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

st.divider()

# --- CSV Import ---
st.subheader("📥 Import Assets (CSV)")
st.caption("CSV columns: name, asset_type, owner, criticality, internet_exposed (0/1)")

uploaded = st.file_uploader("Upload seed_assets.csv", type=["csv"])
if uploaded is not None:
    try:
        df = pd.read_csv(uploaded)

        required_cols = {"name", "asset_type", "owner", "criticality", "internet_exposed"}
        if not required_cols.issubset(set(df.columns)):
            st.error(f"CSV missing required columns. Needed: {sorted(required_cols)}")
        else:
            st.write("Preview:")
            st.dataframe(df.head(10), width="stretch")

            if st.button("Import CSV ✅"):
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

st.divider()

# --- Assets Table + Filters ---
st.subheader("📋 Current Assets")

assets = list_assets()
if not assets:
    st.info("No assets yet. Add one above or seed demo data.")
else:
    df_assets = pd.DataFrame([a.model_dump() for a in assets])
    df_assets["created_at"] = df_assets["created_at"].astype(str)

    # Filters
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

    st.dataframe(
        filtered[["id", "name", "asset_type", "owner", "criticality", "internet_exposed", "created_at"]],
        use_container_width=True,
    )