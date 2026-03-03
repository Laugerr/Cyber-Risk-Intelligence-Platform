from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from core.models import Asset, Vulnerability, Control, Alert

DB_PATH = Path("data") / "crisp.db"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_conn() as conn:
        cur = conn.cursor()

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS assets (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              asset_type TEXT NOT NULL,
              owner TEXT NOT NULL,
              criticality INTEGER NOT NULL,
              internet_exposed INTEGER NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS vulnerabilities (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              asset_id INTEGER NOT NULL,
              cve TEXT NOT NULL,
              title TEXT NOT NULL,
              cvss REAL NOT NULL,
              known_exploited INTEGER NOT NULL,
              detected_at TEXT NOT NULL,
              FOREIGN KEY(asset_id) REFERENCES assets(id)
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS controls (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              annual_cost_eur REAL NOT NULL,
              effectiveness_pct INTEGER NOT NULL,
              notes TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              severity TEXT NOT NULL,
              title TEXT NOT NULL,
              asset_id INTEGER NOT NULL,
              cve TEXT,
              risk_score REAL NOT NULL,
              evidence TEXT NOT NULL,
              created_at TEXT NOT NULL,
              FOREIGN KEY(asset_id) REFERENCES assets(id)
            )
            """
        )


# ---------------------------
# Assets
# ---------------------------
def add_asset(asset: Asset) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO assets (name, asset_type, owner, criticality, internet_exposed, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                asset.name,
                asset.asset_type,
                asset.owner,
                asset.criticality,
                1 if asset.internet_exposed else 0,
                asset.created_at.isoformat(),
            ),
        )
        return int(cur.lastrowid)


def list_assets() -> List[Asset]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM assets ORDER BY id DESC").fetchall()
        out: List[Asset] = []
        for r in rows:
            out.append(
                Asset(
                    id=r["id"],
                    name=r["name"],
                    asset_type=r["asset_type"],
                    owner=r["owner"],
                    criticality=r["criticality"],
                    internet_exposed=bool(r["internet_exposed"]),
                    created_at=datetime.fromisoformat(r["created_at"]),
                )
            )
        return out


def get_asset(asset_id: int) -> Optional[Asset]:
    with get_conn() as conn:
        r = conn.execute("SELECT * FROM assets WHERE id = ?", (asset_id,)).fetchone()
        if not r:
            return None
        return Asset(
            id=r["id"],
            name=r["name"],
            asset_type=r["asset_type"],
            owner=r["owner"],
            criticality=r["criticality"],
            internet_exposed=bool(r["internet_exposed"]),
            created_at=datetime.fromisoformat(r["created_at"]),
        )


# ---------------------------
# Vulnerabilities
# ---------------------------
def add_vulnerability(v: Vulnerability) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO vulnerabilities (asset_id, cve, title, cvss, known_exploited, detected_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                v.asset_id,
                v.cve,
                v.title,
                float(v.cvss),
                1 if v.known_exploited else 0,
                v.detected_at.isoformat(),
            ),
        )
        return int(cur.lastrowid)


def list_vulnerabilities(asset_id: Optional[int] = None) -> List[Vulnerability]:
    with get_conn() as conn:
        if asset_id is None:
            rows = conn.execute("SELECT * FROM vulnerabilities ORDER BY id DESC").fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM vulnerabilities WHERE asset_id = ? ORDER BY id DESC",
                (asset_id,),
            ).fetchall()

        out: List[Vulnerability] = []
        for r in rows:
            out.append(
                Vulnerability(
                    id=r["id"],
                    asset_id=r["asset_id"],
                    cve=r["cve"],
                    title=r["title"],
                    cvss=float(r["cvss"]),
                    known_exploited=bool(r["known_exploited"]),
                    detected_at=datetime.fromisoformat(r["detected_at"]),
                )
            )
        return out


# ---------------------------
# Controls
# ---------------------------
def add_control(c: Control) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO controls (name, annual_cost_eur, effectiveness_pct, notes, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                c.name,
                float(c.annual_cost_eur),
                int(c.effectiveness_pct),
                c.notes,
                c.created_at.isoformat(),
            ),
        )
        return int(cur.lastrowid)


def list_controls() -> List[Control]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM controls ORDER BY id DESC").fetchall()
        out: List[Control] = []
        for r in rows:
            out.append(
                Control(
                    id=r["id"],
                    name=r["name"],
                    annual_cost_eur=float(r["annual_cost_eur"]),
                    effectiveness_pct=int(r["effectiveness_pct"]),
                    notes=r["notes"],
                    created_at=datetime.fromisoformat(r["created_at"]),
                )
            )
        return out


# ---------------------------
# Alerts + Export
# ---------------------------
def save_alert(a: Alert) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO alerts (severity, title, asset_id, cve, risk_score, evidence, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                a.severity,
                a.title,
                a.asset_id,
                a.cve,
                float(a.risk_score),
                a.evidence,
                a.created_at.isoformat(),
            ),
        )
        return int(cur.lastrowid)


def list_alerts(limit: int = 200) -> List[Alert]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM alerts ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()

        out: List[Alert] = []
        for r in rows:
            out.append(
                Alert(
                    id=r["id"],
                    severity=r["severity"],
                    title=r["title"],
                    asset_id=r["asset_id"],
                    cve=r["cve"],
                    risk_score=float(r["risk_score"]),
                    evidence=r["evidence"],
                    created_at=datetime.fromisoformat(r["created_at"]),
                )
            )
        return out


def export_alerts_json(out_dir: Path = Path("exports") / "alerts") -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_path = out_dir / f"alerts_{stamp}.json"

    payload = [a.model_dump() for a in list_alerts(limit=500)]
    # Make datetimes JSON-safe
    for item in payload:
        if "created_at" in item and hasattr(item["created_at"], "isoformat"):
            item["created_at"] = item["created_at"].isoformat()

    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return out_path


def reset_db() -> None:
    """Dangerous: wipes all tables. Useful for demos/dev."""
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("DELETE FROM alerts")
        cur.execute("DELETE FROM vulnerabilities")
        cur.execute("DELETE FROM controls")
        cur.execute("DELETE FROM assets")
        conn.commit()


def asset_name_to_id_map() -> dict[str, int]:
    assets = list_assets()
    return {a.name: a.id for a in assets if a.id is not None}