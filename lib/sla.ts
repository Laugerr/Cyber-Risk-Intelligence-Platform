// Shared SLA / remediation-deadline computation, used by the SLA page API and
// the notification scanner.

import { supabase } from "./supabase";
import { calculateRisk } from "./scoring";
import type { Asset, Vulnerability, Alert, Severity, SlaState, RemediationItem } from "./types";

export const DAY_MS = 86_400_000;
export const DUE_SOON_DAYS = 7;
export const SLA_DEFAULTS: { severity: Severity; days: number }[] = [
  { severity: "CRITICAL", days: 7 },
  { severity: "HIGH", days: 30 },
  { severity: "MEDIUM", days: 90 },
  { severity: "LOW", days: 180 },
];

export async function getPolicy(): Promise<Record<Severity, number>> {
  const { data } = await supabase.from("sla_policy").select("*");
  const policy: Record<string, number> = {};
  for (const row of data ?? []) policy[row.severity] = row.days;
  for (const d of SLA_DEFAULTS) if (policy[d.severity] == null) policy[d.severity] = d.days;
  return policy as Record<Severity, number>;
}

function severityForVuln(v: Vulnerability, asset: Asset | undefined, alertSev: Severity | undefined): Severity {
  if (alertSev) return alertSev;
  if (!asset) return "LOW";
  return calculateRisk(v.cvss, asset.criticality, asset.internet_exposed, v.known_exploited, v.known_exploited, v.epss_score).severity;
}

export function buildItems(
  vulns: Vulnerability[],
  assets: Asset[],
  alerts: Alert[],
  policy: Record<Severity, number>
): RemediationItem[] {
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const alertSev = new Map<string, Severity>();
  for (const a of alerts) alertSev.set(`${a.asset_id}:${a.cve}`, a.severity);

  const now = Date.now();
  return vulns.map((v) => {
    const asset = assetById.get(v.asset_id);
    const severity = severityForVuln(v, asset, alertSev.get(`${v.asset_id}:${v.cve}`));
    const detected = v.detected_at ? new Date(v.detected_at).getTime() : now;
    const due = detected + policy[severity] * DAY_MS;
    const resolved = v.status === "resolved";
    const resolvedAt = v.resolved_at ? new Date(v.resolved_at).getTime() : null;
    const daysRemaining = Math.ceil((due - now) / DAY_MS);

    let state: SlaState;
    if (resolved) state = resolvedAt != null && resolvedAt > due ? "missed" : "met";
    else if (now > due) state = "breached";
    else if (daysRemaining <= DUE_SOON_DAYS) state = "due_soon";
    else state = "on_track";

    return {
      id: v.id!,
      cve: v.cve,
      title: v.title,
      asset_name: asset?.name ?? `asset #${v.asset_id}`,
      severity,
      status: v.status ?? "open",
      detected_at: v.detected_at ?? new Date(now).toISOString(),
      resolved_at: v.resolved_at ?? null,
      due_date: new Date(due).toISOString(),
      days_remaining: daysRemaining,
      sla_state: state,
    };
  });
}

// Convenience: fetch everything and return computed remediation items.
export async function computeRemediationItems(): Promise<RemediationItem[]> {
  const policy = await getPolicy();
  const [vulnsRes, assetsRes, alertsRes] = await Promise.all([
    supabase.from("vulnerabilities").select("*"),
    supabase.from("assets").select("*"),
    supabase.from("alerts").select("*"),
  ]);
  return buildItems(
    (vulnsRes.data ?? []) as Vulnerability[],
    (assetsRes.data ?? []) as Asset[],
    (alertsRes.data ?? []) as Alert[],
    policy
  );
}
