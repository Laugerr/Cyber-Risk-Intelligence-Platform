import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateRisk } from "@/lib/scoring";
import type { Asset, Vulnerability, Alert, Severity, SlaPolicy, SlaState, RemediationItem } from "@/lib/types";

export const runtime = "nodejs";

const DAY_MS = 86_400_000;
const DUE_SOON_DAYS = 7;
const DEFAULTS: SlaPolicy[] = [
  { severity: "CRITICAL", days: 7 },
  { severity: "HIGH", days: 30 },
  { severity: "MEDIUM", days: 90 },
  { severity: "LOW", days: 180 },
];

async function getPolicy(): Promise<Record<Severity, number>> {
  const { data } = await supabase.from("sla_policy").select("*");
  const policy: Record<string, number> = {};
  for (const row of data ?? []) policy[row.severity] = row.days;
  // Fill any missing severities with defaults (also covers an unseeded table).
  for (const d of DEFAULTS) if (policy[d.severity] == null) policy[d.severity] = d.days;
  return policy as Record<Severity, number>;
}

function severityForVuln(
  v: Vulnerability,
  asset: Asset | undefined,
  alertSev: Severity | undefined
): Severity {
  if (alertSev) return alertSev;
  if (!asset) return "LOW";
  return calculateRisk(v.cvss, asset.criticality, asset.internet_exposed, v.known_exploited, v.known_exploited, v.epss_score).severity;
}

function buildItems(
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
    if (resolved) {
      state = resolvedAt != null && resolvedAt > due ? "missed" : "met";
    } else if (now > due) {
      state = "breached";
    } else if (daysRemaining <= DUE_SOON_DAYS) {
      state = "due_soon";
    } else {
      state = "on_track";
    }

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

export async function GET() {
  try {
    const policy = await getPolicy();
    const [vulnsRes, assetsRes, alertsRes] = await Promise.all([
      supabase.from("vulnerabilities").select("*"),
      supabase.from("assets").select("*"),
      supabase.from("alerts").select("*"),
    ]);

    const items = buildItems(
      (vulnsRes.data ?? []) as Vulnerability[],
      (assetsRes.data ?? []) as Asset[],
      (alertsRes.data ?? []) as Alert[],
      policy
    );

    const count = (s: SlaState) => items.filter((i) => i.sla_state === s).length;
    const breached = count("breached");
    const missed = count("missed");
    const violations = breached + missed;
    const total = items.length;
    const overdueItems = items.filter((i) => i.sla_state === "breached");
    const avgOverdue =
      overdueItems.length > 0
        ? Math.round(overdueItems.reduce((s, i) => s + Math.abs(i.days_remaining), 0) / overdueItems.length)
        : 0;

    const summary = {
      total,
      compliance_pct: total > 0 ? Math.round(((total - violations) / total) * 100) : 100,
      breached,
      missed,
      due_soon: count("due_soon"),
      on_track: count("on_track"),
      met: count("met"),
      avg_overdue_days: avgOverdue,
    };

    return NextResponse.json({
      policy: DEFAULTS.map((d) => ({ severity: d.severity, days: policy[d.severity] })),
      items,
      summary,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body: SlaPolicy = await req.json();
  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(body.severity) || !(body.days > 0)) {
    return NextResponse.json({ error: "Invalid severity or days" }, { status: 400 });
  }
  const { error } = await supabase
    .from("sla_policy")
    .upsert({ severity: body.severity, days: Math.round(body.days) }, { onConflict: "severity" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
