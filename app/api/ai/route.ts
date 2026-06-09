import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import type { Asset, Vulnerability, Alert, Control } from "@/lib/types";
import { estimateAle } from "@/lib/rosi";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const MODEL = "claude-opus-4-8";

// Builds a compact, grounded snapshot of the current security posture so the
// model answers from live data instead of guessing.
async function buildContext(): Promise<string> {
  const [assetsRes, vulnsRes, alertsRes, controlsRes] = await Promise.all([
    supabase.from("assets").select("*"),
    supabase.from("vulnerabilities").select("*"),
    supabase.from("alerts").select("*"),
    supabase.from("controls").select("*"),
  ]);

  const assets: Asset[] = assetsRes.data ?? [];
  const vulns: Vulnerability[] = vulnsRes.data ?? [];
  const alerts: Alert[] = alertsRes.data ?? [];
  const controls: Control[] = controlsRes.data ?? [];

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const totalRisk = activeAlerts.reduce((s, a) => s + (a.risk_score || 0), 0);
  const ale = estimateAle(totalRisk);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const sevCount = (s: string) => activeAlerts.filter((a) => a.severity === s).length;

  const topAlerts = [...activeAlerts]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 12)
    .map((a) => {
      const asset = assetById.get(a.asset_id);
      return `- [${a.severity}] ${a.cve ?? "—"} risk=${a.risk_score.toFixed(2)} on "${asset?.name ?? `asset ${a.asset_id}`}"${asset?.internet_exposed ? " (internet-exposed)" : ""}${asset ? `, criticality ${asset.criticality}/5` : ""} — ${a.title}`;
    })
    .join("\n");

  const exploited = vulns.filter((v) => v.known_exploited);
  const openVulns = vulns.filter((v) => v.status !== "resolved");
  const resolvedVulns = vulns.filter((v) => v.status === "resolved");

  const assetLines = assets
    .map(
      (a) =>
        `- "${a.name}" (${a.asset_type}, owner ${a.owner}, criticality ${a.criticality}/5${a.internet_exposed ? ", internet-exposed" : ""})`
    )
    .join("\n");

  const controlLines = controls
    .map(
      (c) =>
        `- ${c.name}: €${c.annual_cost_eur.toLocaleString()}/yr, ${c.effectiveness_pct}% effective`
    )
    .join("\n");

  return `## Live security posture (source of truth — answer from this)

### Summary
- Assets: ${assets.length} (${assets.filter((a) => a.internet_exposed).length} internet-exposed)
- Vulnerabilities: ${vulns.length} total · ${openVulns.length} open · ${resolvedVulns.length} resolved · ${exploited.length} known-exploited (CISA KEV)
- Active (unacknowledged) alerts: ${activeAlerts.length} — CRITICAL ${sevCount("CRITICAL")}, HIGH ${sevCount("HIGH")}, MEDIUM ${sevCount("MEDIUM")}, LOW ${sevCount("LOW")}
- Aggregate active risk score: ${totalRisk.toFixed(2)}
- Estimated Annual Loss Expectancy (ALE): €${ale.toLocaleString()}

### Top risk alerts
${topAlerts || "None."}

### Assets
${assetLines || "None."}

### Security controls
${controlLines || "None."}`;
}

const SYSTEM = `You are CRISP Analyst, the AI cyber-risk advisor embedded in the CRISP (Cyber Risk Intelligence Platform) dashboard. You help a security analyst understand and act on their organization's risk posture.

Risk model used by the platform:
- risk_score = CVSS × criticality_multiplier × exposure_multiplier, plus bonuses: +1.5 if the CVE is in CISA KEV (actively exploited), and an EPSS-based bonus up to +1.5.
- Severity bands on the resulting score: CRITICAL ≥ 12, HIGH ≥ 9, MEDIUM ≥ 5, LOW < 5.
- ALE (Annual Loss Expectancy) is estimated as aggregate active risk × €10,000.

Guidance:
- Answer strictly from the live posture provided in the user context. If something isn't in the data, say so plainly rather than inventing it.
- Prioritize by what actually reduces risk: KEV/actively-exploited first, then internet-exposed high-criticality assets, then raw score.
- Be concise and practical. Use short markdown — headers, tight bullets, and a bold lead line for the answer. Plain text only, no LaTeX.
- When asked "what should I fix first" give a ranked, justified shortlist tied to specific CVEs and assets from the data.
- Explain CVEs and scores in plain language a manager could follow, but stay technically accurate.`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "The AI assistant is not configured on the server." },
      { status: 500 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const history = (body.messages ?? [])
    .filter((m) => m.content?.trim())
    .slice(-12); // keep the last few turns

  if (history.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  const context = await buildContext();
  const client = new Anthropic({ apiKey });

  // Inject the live posture as a system-role message after the conversation so
  // it stays fresh each turn without bloating every user message.
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claude = client.messages.stream({
          model: MODEL,
          max_tokens: 2048,
          system: `${SYSTEM}\n\n${context}`,
          messages,
        });

        claude.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });

        await claude.finalMessage();
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI request failed.";
        controller.enqueue(encoder.encode(`\n\n_Error: ${msg}_`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
