import { supabase } from "@/lib/supabase";
import type { Asset, Vulnerability, Alert, Control } from "@/lib/types";
import { estimateAle } from "@/lib/rosi";
import { analyze, type Posture } from "@/lib/analyst";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatMessage = { role: "user" | "assistant"; content: string };

const MODEL = "claude-opus-4-8";

async function fetchPosture(): Promise<Posture> {
  const [assetsRes, vulnsRes, alertsRes, controlsRes] = await Promise.all([
    supabase.from("assets").select("*"),
    supabase.from("vulnerabilities").select("*"),
    supabase.from("alerts").select("*"),
    supabase.from("controls").select("*"),
  ]);
  return {
    assets: (assetsRes.data ?? []) as Asset[],
    vulns: (vulnsRes.data ?? []) as Vulnerability[],
    alerts: (alertsRes.data ?? []) as Alert[],
    controls: (controlsRes.data ?? []) as Control[],
  };
}

// Compact snapshot used only when an LLM key is configured.
function buildContext(p: Posture): string {
  const activeAlerts = p.alerts.filter((a) => !a.acknowledged);
  const totalRisk = activeAlerts.reduce((s, a) => s + (a.risk_score || 0), 0);
  const assetById = new Map(p.assets.map((a) => [a.id, a]));
  const sevCount = (s: string) => activeAlerts.filter((a) => a.severity === s).length;
  const topAlerts = [...activeAlerts]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 12)
    .map((a) => {
      const asset = assetById.get(a.asset_id);
      return `- [${a.severity}] ${a.cve ?? "—"} risk=${a.risk_score.toFixed(2)} on "${asset?.name ?? `asset ${a.asset_id}`}"${asset?.internet_exposed ? " (internet-exposed)" : ""}${asset ? `, criticality ${asset.criticality}/5` : ""} — ${a.title}`;
    })
    .join("\n");
  const assetLines = p.assets
    .map((a) => `- "${a.name}" (${a.asset_type}, owner ${a.owner}, criticality ${a.criticality}/5${a.internet_exposed ? ", internet-exposed" : ""})`)
    .join("\n");
  const controlLines = p.controls
    .map((c) => `- ${c.name}: €${c.annual_cost_eur.toLocaleString()}/yr, ${c.effectiveness_pct}% effective`)
    .join("\n");
  return `## Live security posture (source of truth — answer from this)

### Summary
- Assets: ${p.assets.length} (${p.assets.filter((a) => a.internet_exposed).length} internet-exposed)
- Vulnerabilities: ${p.vulns.length} total · ${p.vulns.filter((v) => v.status === "resolved").length} resolved · ${p.vulns.filter((v) => v.known_exploited).length} known-exploited (CISA KEV)
- Active alerts: ${activeAlerts.length} — CRITICAL ${sevCount("CRITICAL")}, HIGH ${sevCount("HIGH")}, MEDIUM ${sevCount("MEDIUM")}, LOW ${sevCount("LOW")}
- Aggregate active risk score: ${totalRisk.toFixed(2)}
- Estimated ALE: €${estimateAle(totalRisk).toLocaleString()}

### Top risk alerts
${topAlerts || "None."}

### Assets
${assetLines || "None."}

### Security controls
${controlLines || "None."}`;
}

const SYSTEM = `You are CRISP Analyst, the AI cyber-risk advisor embedded in the CRISP dashboard.
Risk model: risk_score = CVSS × criticality_multiplier × exposure_multiplier, +1.5 if CVE is in CISA KEV, plus an EPSS bonus up to +1.5. Severity: CRITICAL ≥ 12, HIGH ≥ 9, MEDIUM ≥ 5, LOW < 5. ALE = aggregate active risk × €10,000.
Answer strictly from the live posture provided. Prioritize KEV/exploited first, then internet-exposed high-criticality assets, then raw score. Be concise and practical with short markdown — bold lead line, tight bullets, plain text (no LaTeX). If something isn't in the data, say so rather than inventing it.`;

function streamText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Emit in small chunks so the UI shows a live "typing" effect.
      const tokens = text.match(/\S+\s*/g) ?? [text];
      for (let i = 0; i < tokens.length; i++) {
        controller.enqueue(encoder.encode(tokens[i]));
        if (i % 3 === 0) await new Promise((r) => setTimeout(r, 12));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const history = (body.messages ?? []).filter((m) => m.content?.trim()).slice(-12);
  if (history.length === 0) return Response.json({ error: "No messages provided." }, { status: 400 });

  const posture = await fetchPosture();
  const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Default path: free, key-less local analyst engine.
  if (!apiKey) {
    return streamText(analyze(lastUser, posture));
  }

  // Optional enhanced path: stream from the LLM when a key is configured.
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const messages = history.map((m) => ({ role: m.role, content: m.content }));

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const claude = client.messages.stream({
            model: MODEL,
            max_tokens: 2048,
            system: `${SYSTEM}\n\n${buildContext(posture)}`,
            messages,
          });
          claude.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
          await claude.finalMessage();
          controller.close();
        } catch {
          // Fall back to the local engine inside the stream.
          controller.enqueue(encoder.encode(analyze(lastUser, posture)));
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
    });
  } catch {
    return streamText(analyze(lastUser, posture));
  }
}
