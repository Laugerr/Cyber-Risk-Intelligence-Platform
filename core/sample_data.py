from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from core.models import Asset, Vulnerability, Control, Alert
from core.storage import (
    add_asset,
    add_control,
    add_vulnerability,
    clear_alerts,
    get_asset,
    init_db,
    list_assets,
    list_vulnerabilities,
    reset_db,
    save_alert,
)
from core.scoring import calculate_risk


DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def seed_assets() -> None:
    df = pd.read_csv(DATA_DIR / "seed_assets.csv")
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
    data = json.loads((DATA_DIR / "seed_vulns.json").read_text(encoding="utf-8"))

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


def generate_alerts_from_vulns(limit: int = 500, replace_existing: bool = True) -> None:
    if replace_existing:
        clear_alerts()

    vulns = list_vulnerabilities()
    count = 0

    for v in vulns:
        asset = get_asset(v.asset_id)
        if not asset:
            continue

        rr = calculate_risk(
            cvss=v.cvss,
            criticality=asset.criticality,
            internet_exposed=asset.internet_exposed,
            known_exploited=v.known_exploited,
            epss_score=v.epss_score,
        )

        title = f"{rr.severity}: {v.cve} on {asset.name}"
        evidence = (
            f"CVSS={v.cvss} | criticality={asset.criticality} | "
            f"internet_exposed={asset.internet_exposed} | known_exploited={v.known_exploited} | "
            f"epss_score={v.epss_score} | "
            f"title={v.title}"
        )

        # Spread alerts across the last 21 days for trend visualization
        days_ago = random.randint(0, 20)
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        simulated_created_at = datetime.utcnow() - timedelta(
            days=days_ago,
            hours=hours_ago,
            minutes=minutes_ago,
        )

        save_alert(
            Alert(
                severity=rr.severity,
                title=title,
                asset_id=asset.id,
                cve=v.cve,
                risk_score=rr.risk_score,
                evidence=evidence,
                created_at=simulated_created_at,
            )
        )

        count += 1
        if count >= limit:
            break

def run_seed() -> None:
    init_db()
    reset_db()
    seed_assets()
    seed_controls()
    seed_vulns()
    generate_alerts_from_vulns(replace_existing=True)


if __name__ == "__main__":
    run_seed()
    print("✅ Seed complete: assets, controls, vulnerabilities inserted into SQLite.")
