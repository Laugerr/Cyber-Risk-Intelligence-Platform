import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { computeRemediationItems } from "@/lib/sla";
import type { Asset, Vulnerability, Alert, Notification, NotificationSettings } from "@/lib/types";

export const runtime = "nodejs";

type NewNotif = Omit<Notification, "id" | "created_at" | "read">;

// Scan current state for notable events and create notifications for any not
// already recorded (deduped). Pushes a summary to the webhook when enabled.
// GET is used by the daily Vercel cron; POST for manual "Scan now".
export async function GET() { return scan(); }
export async function POST() { return scan(); }

async function scan() {
  try {
    const [settingsRes, assetsRes, vulnsRes, alertsRes, existingRes, items] = await Promise.all([
      supabase.from("notification_settings").select("*").eq("id", 1).single(),
      supabase.from("assets").select("*"),
      supabase.from("vulnerabilities").select("*"),
      supabase.from("alerts").select("*"),
      supabase.from("notifications").select("dedupe_key"),
      computeRemediationItems(),
    ]);

    const settings: NotificationSettings = settingsRes.data ?? {
      enabled: true, webhook_url: "", notify_kev: true, notify_critical: true, notify_sla: true,
    };
    const assets = (assetsRes.data ?? []) as Asset[];
    const vulns = (vulnsRes.data ?? []) as Vulnerability[];
    const alerts = (alertsRes.data ?? []) as Alert[];
    const assetName = (id: number) => assets.find((a) => a.id === id)?.name ?? `asset #${id}`;
    const seen = new Set((existingRes.data ?? []).map((n) => n.dedupe_key));

    const candidates: NewNotif[] = [];

    // 1. Actively-exploited (KEV) vulnerabilities
    if (settings.notify_kev) {
      for (const v of vulns) {
        if (v.known_exploited && v.status !== "resolved") {
          candidates.push({
            dedupe_key: `kev:${v.asset_id}:${v.cve}`,
            type: "kev",
            severity: "CRITICAL",
            title: `Actively exploited CVE on ${assetName(v.asset_id)}`,
            body: `${v.cve} is in CISA KEV (exploited in the wild) — ${v.title}`,
          });
        }
      }
    }

    // 2. Critical risk alerts
    if (settings.notify_critical) {
      for (const a of alerts) {
        if (a.severity === "CRITICAL" && !a.acknowledged) {
          candidates.push({
            dedupe_key: `critical:${a.id}`,
            type: "critical",
            severity: "CRITICAL",
            title: `Critical alert on ${assetName(a.asset_id)}`,
            body: `${a.cve ?? ""} ${a.title} — risk score ${a.risk_score.toFixed(1)}`.trim(),
          });
        }
      }
    }

    // 3. SLA breaches
    if (settings.notify_sla) {
      for (const i of items) {
        if (i.sla_state === "breached") {
          candidates.push({
            dedupe_key: `sla:${i.id}`,
            type: "sla_breach",
            severity: i.severity,
            title: `SLA breach: ${i.cve}`,
            body: `${i.asset_name} — ${Math.abs(i.days_remaining)}d overdue (${i.severity}, due ${new Date(i.due_date).toLocaleDateString("en-GB")})`,
          });
        }
      }
    }

    const fresh = candidates.filter((c) => !seen.has(c.dedupe_key));
    // Dedupe within this batch too
    const uniq = Array.from(new Map(fresh.map((c) => [c.dedupe_key, c])).values());

    if (uniq.length > 0) {
      await supabase.from("notifications").insert(uniq);
    }

    // Push a single summary to the webhook
    if (uniq.length > 0 && settings.enabled && settings.webhook_url?.trim()) {
      const lines = uniq.slice(0, 15).map((n) => `• ${emoji(n.type)} ${n.title} — ${n.body}`);
      const more = uniq.length > 15 ? `\n…and ${uniq.length - 15} more` : "";
      await fetch(settings.webhook_url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🛡️ *CRISP* — ${uniq.length} new security notification${uniq.length > 1 ? "s" : ""}\n${lines.join("\n")}${more}`,
          source: "CRISP",
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ created: uniq.length, scanned: candidates.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function emoji(type: string): string {
  return type === "sla_breach" ? "⏰" : type === "critical" ? "🔴" : "💥";
}
