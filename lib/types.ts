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

export type VulnStatus = "open" | "in_progress" | "resolved";

export interface Vulnerability {
  id?: number;
  asset_id: number;
  cve: string;
  title: string;
  cvss: number;
  known_exploited: boolean;
  epss_score?: number | null;
  status?: VulnStatus;
  detected_at?: string;
  resolved_at?: string | null;
}

export interface RiskSnapshot {
  id?: number;
  captured_on: string; // YYYY-MM-DD
  total_risk: number;
  ale: number;
  asset_count: number;
  vuln_count: number;
  open_count: number;
  in_progress_count: number;
  resolved_count: number;
  exploited_count: number;
  critical_count: number;
  high_count: number;
  active_alerts: number;
  mttr_days: number | null;
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
  acknowledged?: boolean;
  created_at?: string;
}

export interface RiskResult {
  risk_score: number;
  severity: Severity;
  exploited_bonus: number;
  kev_bonus: number;
  epss_bonus: number;
}
