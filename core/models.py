from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


AssetType = Literal["Server", "Workstation", "Cloud", "Network", "WebApp", "Database", "Other"]


class Asset(BaseModel):
    id: Optional[int] = None
    name: str
    asset_type: AssetType = "Other"
    owner: str = "IT"
    criticality: int = Field(default=3, ge=1, le=5)  # 1 (low) -> 5 (mission critical)
    internet_exposed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Vulnerability(BaseModel):
    id: Optional[int] = None
    asset_id: int
    cve: str
    title: str
    cvss: float = Field(ge=0, le=10)
    known_exploited: bool = False
    epss_score: Optional[float] = Field(default=None, ge=0, le=1)
    detected_at: datetime = Field(default_factory=datetime.utcnow)


class Control(BaseModel):
    id: Optional[int] = None
    name: str
    annual_cost_eur: float = Field(ge=0)
    effectiveness_pct: int = Field(default=30, ge=0, le=100)  # assumed risk reduction %
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Alert(BaseModel):
    id: Optional[int] = None
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    title: str
    asset_id: int
    cve: Optional[str] = None
    risk_score: float = 0.0
    evidence: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)
