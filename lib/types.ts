export type AssetType = "Server" | "Workstation" | "Cloud" | "Network" | "WebApp" | "Database" | "Other";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Asset {
  id?: number;
  name: string;
  asset_type: AssetType;
  owner: string;
  criticality: number; // 1–5
  internet_exposed: boolean;
  created_at?: string;
}

export interface Vulnerability {
  id?: number;
  asset_id: number;
  cve: string;
  title: string;
  cvss: number;
  known_exploited: boolean;
  epss_score?: number | null;
  detected_at?: string;
}

export interface Control {
  id?: number;
  name: string;
  annual_cost_eur: number;
  effectiveness_pct: number; // 0–100
  notes: string;
  created_at?: string;
}

export interface Alert {
  id?: number;
  severity: Severity;
  title: string;
  asset_id: number;
  cve?: string | null;
  risk_score: number;
  evidence: string;
  created_at?: string;
}

export interface RiskResult {
  risk_score: number;
  severity: Severity;
  exploited_bonus: number;
  kev_bonus: number;
  epss_bonus: number;
}
