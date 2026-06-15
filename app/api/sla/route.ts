import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { computeRemediationItems, SLA_DEFAULTS, getPolicy } from "@/lib/sla";
import type { SlaPolicy, SlaState } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [policy, items] = await Promise.all([getPolicy(), computeRemediationItems()]);

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
      policy: SLA_DEFAULTS.map((d) => ({ severity: d.severity, days: policy[d.severity] })),
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
