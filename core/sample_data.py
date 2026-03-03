from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from core.models import Asset, Vulnerability, Control
from core.storage import init_db, add_asset, add_vulnerability, add_control, list_assets


def seed_assets() -> None:
    df = pd.read_csv(Path("data") / "seed_assets.csv")
    for _, row in df.iterrows():
        asset = Asset(
            name=str(row["name"]),
            asset_type=str(row["asset_type"]),
            owner=str(row["owner"]),
            criticality=int(row["criticality"]),
            internet_exposed=bool(int(row["internet_exposed"])),
        )
        add_asset(asset)


def seed_vulns() -> None:
    assets = {a.name: a for a in list_assets()}
    data = json.loads((Path("data") / "seed_vulns.json").read_text(encoding="utf-8"))

    for item in data:
        asset = assets.get(item["asset_name"])
        if not asset or not asset.id:
            continue
        v = Vulnerability(
            asset_id=asset.id,
            cve=item["cve"],
            title=item["title"],
            cvss=float(item["cvss"]),
            known_exploited=bool(item["known_exploited"]),
        )
        add_vulnerability(v)


def seed_controls() -> None:
    # Starter controls (we’ll expand later)
    controls = [
        Control(name="MFA Everywhere", annual_cost_eur=1200, effectiveness_pct=35, notes="Reduce account takeover risk"),
        Control(name="Patch Management Program", annual_cost_eur=2500, effectiveness_pct=45, notes="Reduce known exploited vulns"),
        Control(name="WAF for Public Apps", annual_cost_eur=1800, effectiveness_pct=25, notes="Reduce web attack exposure"),
        Control(name="EDR on Endpoints", annual_cost_eur=3000, effectiveness_pct=30, notes="Improve detection & containment")
    ]
    for c in controls:
        add_control(c)


def run_seed() -> None:
    init_db()
    seed_assets()
    seed_controls()
    seed_vulns()


if __name__ == "__main__":
    run_seed()
    print("✅ Seed complete: assets, controls, vulnerabilities inserted into SQLite.")