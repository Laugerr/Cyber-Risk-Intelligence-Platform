import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { estimateAle } from "@/lib/rosi";
import type { Vulnerability, Alert, RiskSnapshot } from "@/lib/types";

export const runtime = "nodejs";

type SnapshotMetrics = Omit<RiskSnapshot, "id" | "captured_on">;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Compute the live posture metrics for a snapshot row.
async function computeCurrent(): Promise<SnapshotMetrics> {
  const [assetsRes, vulnsRes, alertsRes] = await Promise.all([
    supabase.from("assets").select("id"),
    supabase.from("vulnerabilities").select("*"),
    supabase.from("alerts").select("*"),
  ]);

  const vulns: Vulnerability[] = vulnsRes.data ?? [];
  const alerts: Alert[] = alertsRes.data ?? [];
  const active = alerts.filter((a) => !a.acknowledged);

  const open = vulns.filter((v) => !v.status || v.status === "open").length;
  const inProgress = vulns.filter((v) => v.status === "in_progress").length;
  const resolved = vulns.filter((v) => v.status === "resolved").length;
  const exploited = vulns.filter((v) => v.known_exploited && v.status !== "resolved").length;
  const totalRisk = active.reduce((s, a) => s + (a.risk_score || 0), 0);

  // Mean time to remediate (days) over vulns that have both timestamps.
  const remediated = vulns.filter((v) => v.status === "resolved" && v.resolved_at && v.detected_at);
  let mttr: number | null = null;
  if (remediated.length > 0) {
    const totalDays = remediated.reduce((s, v) => {
      const ms = new Date(v.resolved_at as string).getTime() - new Date(v.detected_at as string).getTime();
      return s + Math.max(0, ms) / 86_400_000;
    }, 0);
    mttr = Math.round((totalDays / remediated.length) * 10) / 10;
  }

  return {
    total_risk: Math.round(totalRisk * 100) / 100,
    ale: estimateAle(totalRisk),
    asset_count: assetsRes.data?.length ?? 0,
    vuln_count: vulns.length,
    open_count: open,
    in_progress_count: inProgress,
    resolved_count: resolved,
    exploited_count: exploited,
    critical_count: active.filter((a) => a.severity === "CRITICAL").length,
    high_count: active.filter((a) => a.severity === "HIGH").length,
    active_alerts: active.length,
    mttr_days: mttr,
  };
}

async function history() {
  const { data } = await supabase
    .from("risk_snapshots")
    .select("*")
    .order("captured_on", { ascending: true });
  return data ?? [];
}

// GET — capture (or refresh) today's snapshot and return the full history.
// Also the endpoint the daily Vercel cron hits.
export async function GET() {
  try {
    const metrics = await computeCurrent();
    const { error } = await supabase
      .from("risk_snapshots")
      .upsert({ captured_on: isoDaysAgo(0), ...metrics }, { onConflict: "captured_on" });
    if (error) throw error;
    return NextResponse.json({ captured: true, snapshots: await history() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — backfill a believable 30-day demo history that converges to the live
// numbers today, so the Trends charts are populated immediately on the demo.
export async function POST() {
  try {
    const cur = await computeCurrent();
    const DAYS = 30;
    const rows: RiskSnapshot[] = [];

    for (let i = DAYS - 1; i >= 0; i--) {
      if (i === 0) {
        rows.push({ captured_on: isoDaysAgo(0), ...cur });
        continue;
      }
      // Deterministic smooth curve (smoothstep) with a gentle, reproducible
      // wave — a believable discovery→remediation story, not random jitter.
      const t = 1 - i / (DAYS - 1);
      const f = t * t * (3 - 2 * t);
      const wave = 1 + 0.02 * Math.sin(i * 0.7);
      const grow = (target: number, floor: number) => Math.round(target * (floor + (1 - floor) * f) * wave);

      const vuln_count = grow(cur.vuln_count, 0.45);
      const resolved_count = Math.round(cur.resolved_count * f);
      const in_progress_count = Math.min(grow(Math.max(cur.in_progress_count, 1), 0.3), vuln_count);
      const open_count = Math.max(0, vuln_count - resolved_count - in_progress_count);
      const total_risk = Math.round(cur.total_risk * (0.45 + 0.55 * f) * wave * 100) / 100;

      rows.push({
        captured_on: isoDaysAgo(i),
        total_risk,
        ale: estimateAle(total_risk),
        asset_count: cur.asset_count,
        vuln_count,
        open_count,
        in_progress_count,
        resolved_count,
        exploited_count: grow(cur.exploited_count, 0.5),
        critical_count: grow(cur.critical_count, 0.4),
        high_count: grow(cur.high_count, 0.4),
        active_alerts: grow(cur.active_alerts, 0.45),
        mttr_days: Math.round((20 - 9 * f + 1.2 * Math.sin(i * 0.45)) * 10) / 10,
      });
    }

    const { error } = await supabase
      .from("risk_snapshots")
      .upsert(rows, { onConflict: "captured_on" });
    if (error) throw error;
    return NextResponse.json({ backfilled: rows.length, snapshots: await history() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
