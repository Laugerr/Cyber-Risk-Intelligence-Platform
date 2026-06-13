import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { assess, type Decision } from "@/lib/ssvc";
import type { Asset, Vulnerability, Alert, Severity } from "@/lib/types";

export const runtime = "nodejs";

// GET — assess every unresolved vulnerability with SSVC and return a queue
// sorted by decision urgency (Act > Attend > Track* > Track), then risk score.
export async function GET() {
  try {
    const [vulnsRes, assetsRes, alertsRes] = await Promise.all([
      supabase.from("vulnerabilities").select("*"),
      supabase.from("assets").select("*"),
      supabase.from("alerts").select("*"),
    ]);

    const assets = (assetsRes.data ?? []) as Asset[];
    const vulns = ((vulnsRes.data ?? []) as Vulnerability[]).filter((v) => v.status !== "resolved");
    const alerts = (alertsRes.data ?? []) as Alert[];

    const assetById = new Map(assets.map((a) => [a.id, a]));
    const alertByKey = new Map<string, Alert>();
    for (const a of alerts) alertByKey.set(`${a.asset_id}:${a.cve}`, a);

    const items = vulns
      .map((v) => {
        const asset = assetById.get(v.asset_id);
        const alert = alertByKey.get(`${v.asset_id}:${v.cve}`);
        return {
          id: v.id!,
          cve: v.cve,
          title: v.title,
          asset_name: asset?.name ?? `asset #${v.asset_id}`,
          severity: (alert?.severity ?? null) as Severity | null,
          cvss: v.cvss,
          epss_score: v.epss_score ?? null,
          known_exploited: v.known_exploited,
          risk_score: alert?.risk_score ?? 0,
          ssvc: assess(v, asset),
        };
      })
      .sort((a, b) => a.ssvc.priority - b.ssvc.priority || b.risk_score - a.risk_score);

    const counts: Record<Decision, number> = { Act: 0, Attend: 0, "Track*": 0, Track: 0 };
    for (const i of items) counts[i.ssvc.decision]++;

    return NextResponse.json({
      items,
      summary: {
        total: items.length,
        act: counts.Act,
        attend: counts.Attend,
        track_star: counts["Track*"],
        track: counts.Track,
        needs_action: counts.Act + counts.Attend,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
