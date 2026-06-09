import type { Asset, Vulnerability, Alert, Control } from "./types";
import { estimateAle, calculateRosi } from "./rosi";

export interface Posture {
  assets: Asset[];
  vulns: Vulnerability[];
  alerts: Alert[];
  controls: Control[];
}

const eur = (n: number) => `€${Math.round(n).toLocaleString()}`;

function sevTag(s: string): string {
  return { CRITICAL: "🔴", HIGH: "🟠", MEDIUM: "🟡", LOW: "🟢" }[s] ?? "•";
}

// Pull the matching vulnerability for an alert (for KEV / EPSS context).
function vulnForAlert(p: Posture, alert: Alert): Vulnerability | undefined {
  return p.vulns.find((v) => v.asset_id === alert.asset_id && v.cve === alert.cve);
}

function assetName(p: Posture, id: number): string {
  return p.assets.find((a) => a.id === id)?.name ?? `asset #${id}`;
}

/**
 * Local, key-less "analyst". Detects the user's intent from keywords and
 * answers from the live posture — no external API, no cost.
 */
export function analyze(question: string, p: Posture): string {
  const q = question.toLowerCase();
  const activeAlerts = p.alerts.filter((a) => !a.acknowledged);

  if (p.assets.length === 0 && p.vulns.length === 0) {
    return `**No data loaded yet.**\n\nI answer from your live assets, CVEs, and alerts — but there's nothing to analyze right now. Head to the dashboard and click **Load Demo Data** to seed 8 assets and a set of real CVEs, then ask me again.`;
  }

  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const cveMatch = question.toUpperCase().match(/CVE-\d{4}-\d{4,7}/);

  // 1. Specific CVE explanation
  if (cveMatch) return explainCve(p, cveMatch[0]);

  // 2. Prioritization
  if (has("fix first", "prioriti", "what should i fix", "top risk", "most urgent", "where to start", "worst"))
    return prioritize(p, activeAlerts);

  // 3. Internet exposure / attack surface
  if (has("exposed", "internet", "attack surface", "public", "external"))
    return exposure(p, activeAlerts);

  // 4. KEV / actively exploited
  if (has("kev", "exploited", "in the wild", "active exploit"))
    return kev(p);

  // 5. ROSI / controls / investment
  if (has("rosi", "control", "invest", "worth it", "return", "cost-effective", "spend"))
    return rosi(p, activeAlerts);

  // 6. ALE / financial exposure
  if (has("ale", "loss expectancy", "financial", "how much", "exposure in", "€", "money", "cost of"))
    return ale(p, activeAlerts);

  // 7. Remediation progress
  if (has("resolved", "progress", "remediat", "fixed so far", "status of"))
    return progress(p);

  // 8. Posture summary (also the catch-all for greetings / help)
  return summary(p, activeAlerts);
}

function rankedAlerts(p: Posture, alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const va = vulnForAlert(p, a);
    const vb = vulnForAlert(p, b);
    const ka = va?.known_exploited ? 1 : 0;
    const kb = vb?.known_exploited ? 1 : 0;
    if (ka !== kb) return kb - ka; // KEV first
    return b.risk_score - a.risk_score; // then by score
  });
}

function prioritize(p: Posture, alerts: Alert[]): string {
  if (alerts.length === 0)
    return `**You're clear.** There are no active (unacknowledged) alerts to prioritize right now. ${p.alerts.length > 0 ? "All current alerts have been acknowledged." : "Add vulnerabilities or load demo data to generate alerts."}`;

  const ranked = rankedAlerts(p, alerts).slice(0, 5);
  const lines = ranked
    .map((a, i) => {
      const v = vulnForAlert(p, a);
      const asset = p.assets.find((x) => x.id === a.asset_id);
      const reasons: string[] = [];
      if (v?.known_exploited) reasons.push("**actively exploited (CISA KEV)**");
      if (asset?.internet_exposed) reasons.push("internet-exposed");
      if (asset && asset.criticality >= 4) reasons.push(`high criticality (${asset.criticality}/5)`);
      if (v?.epss_score != null && v.epss_score >= 0.4) reasons.push(`EPSS ${(v.epss_score * 100).toFixed(0)}%`);
      const why = reasons.length ? reasons.join(", ") : `CVSS ${v?.cvss ?? "?"}`;
      return `${i + 1}. ${sevTag(a.severity)} **${a.cve ?? a.title}** on *${assetName(p, a.asset_id)}* — risk **${a.risk_score.toFixed(1)}**\n   _Why:_ ${why}`;
    })
    .join("\n");

  const kevCount = alerts.filter((a) => vulnForAlert(p, a)?.known_exploited).length;
  return `**Fix these first.** Ranked by active exploitation, then exposure and risk score.\n\n${lines}\n\n${kevCount > 0 ? `Start with the **${kevCount} actively-exploited** item${kevCount > 1 ? "s" : ""} — those are being weaponized in the wild right now.` : "None are in CISA KEV, so work top-down by risk score and exposure."}`;
}

function exposure(p: Posture, alerts: Alert[]): string {
  const exposed = p.assets.filter((a) => a.internet_exposed);
  if (exposed.length === 0)
    return `**No internet-exposed assets.** Every asset in the inventory is internal-only, which removes the most common initial-access vector. Keep new public-facing assets flagged so their risk multiplier (×1.3) is applied.`;

  const withRisk = exposed
    .map((asset) => {
      const score = alerts
        .filter((al) => al.asset_id === asset.id)
        .reduce((s, al) => s + al.risk_score, 0);
      return { asset, score };
    })
    .sort((a, b) => b.score - a.score);

  const lines = withRisk
    .map(
      ({ asset, score }) =>
        `- **${asset.name}** (${asset.asset_type}, criticality ${asset.criticality}/5) — active risk **${score.toFixed(1)}**`
    )
    .join("\n");

  return `**${exposed.length} internet-exposed asset${exposed.length > 1 ? "s" : ""}** — your external attack surface, highest active risk first:\n\n${lines}\n\nThese carry a 1.3× exposure multiplier in the risk model. Prioritize patching anything exploited or high-criticality among them.`;
}

function kev(p: Posture): string {
  const exploited = p.vulns.filter((v) => v.known_exploited);
  if (exploited.length === 0)
    return `**Nothing in CISA KEV.** None of your tracked CVEs are on the Known Exploited Vulnerabilities list right now. That's the best-case signal — no confirmed active exploitation against your stack. Keep the daily KEV sync running so this stays current.`;

  const lines = exploited
    .map((v) => `- **${v.cve}** on *${assetName(p, v.asset_id)}* — CVSS ${v.cvss}${v.epss_score != null ? `, EPSS ${(v.epss_score * 100).toFixed(0)}%` : ""}`)
    .join("\n");
  return `**${exploited.length} actively-exploited CVE${exploited.length > 1 ? "s" : ""}** (CISA KEV) — being used in real attacks, treat as top priority:\n\n${lines}\n\nKEV membership adds +1.5 to each one's risk score. Patch or isolate these before anything else.`;
}

function rosi(p: Posture, alerts: Alert[]): string {
  const totalRisk = alerts.reduce((s, a) => s + a.risk_score, 0);
  const aleBefore = estimateAle(totalRisk);
  if (p.controls.length === 0)
    return `**No security controls modeled yet.** Your current Annual Loss Expectancy is **${eur(aleBefore)}**. Add controls on the Risk & ROSI page (cost + effectiveness %) and I'll show projected risk reduction and return on each.`;

  const lines = p.controls
    .map((c) => {
      const { riskReductionValue, rosi } = calculateRosi(aleBefore, c.annual_cost_eur, c.effectiveness_pct);
      const verdict = rosi > 0 ? `✅ **+${(rosi * 100).toFixed(0)}%** ROSI` : `⚠️ **${(rosi * 100).toFixed(0)}%** ROSI`;
      return `- **${c.name}** — ${eur(c.annual_cost_eur)}/yr, ${c.effectiveness_pct}% effective → avoids ${eur(riskReductionValue)} → ${verdict}`;
    })
    .join("\n");

  const best = p.controls
    .map((c) => ({ c, r: calculateRosi(aleBefore, c.annual_cost_eur, c.effectiveness_pct).rosi }))
    .sort((a, b) => b.r - a.r)[0];

  return `**ROSI evaluation** against a baseline ALE of **${eur(aleBefore)}**:\n\n${lines}\n\nBest return: **${best.c.name}** (${(best.r * 100).toFixed(0)}% ROSI). A positive ROSI means the control avoids more expected loss than it costs — fund those first.`;
}

function ale(p: Posture, alerts: Alert[]): string {
  const totalRisk = alerts.reduce((s, a) => s + a.risk_score, 0);
  const value = estimateAle(totalRisk);
  const crit = alerts.filter((a) => a.severity === "CRITICAL").length;
  const high = alerts.filter((a) => a.severity === "HIGH").length;
  return `**Estimated Annual Loss Expectancy: ${eur(value)}.**\n\nThis is your aggregate active risk score (**${totalRisk.toFixed(1)}** across ${alerts.length} unacknowledged alert${alerts.length === 1 ? "" : "s"}) × €10,000 — the model's annualized financial exposure.\n\n- ${crit} critical and ${high} high-severity alerts are the main drivers.\n- Resolving or acknowledging high-risk alerts lowers this figure directly.\n\nAsk me about **ROSI** to see which controls would reduce it most cost-effectively.`;
}

function progress(p: Posture): string {
  const resolved = p.vulns.filter((v) => v.status === "resolved").length;
  const inProgress = p.vulns.filter((v) => v.status === "in_progress").length;
  const open = p.vulns.filter((v) => v.status !== "resolved" && v.status !== "in_progress").length;
  const total = p.vulns.length;
  const pct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return `**Remediation progress: ${resolved}/${total} resolved (${pct}%).**\n\n- 🟢 Resolved: ${resolved}\n- 🟡 In progress: ${inProgress}\n- 🔴 Open: ${open}\n\n${open > 0 ? `You have **${open} open** vulnerabilit${open === 1 ? "y" : "ies"} left. Ask me **"what should I fix first?"** for a ranked plan.` : "Everything is either resolved or in progress — nice work."}`;
}

function explainCve(p: Posture, cve: string): string {
  const v = p.vulns.find((x) => x.cve === cve);
  if (!v) return `I don't have **${cve}** in your tracked vulnerabilities. Add it on the Vulnerabilities page (you can search NVD live) and I'll be able to explain its risk in context.`;

  const asset = p.assets.find((a) => a.id === v.asset_id);
  const alert = p.alerts.find((a) => a.cve === cve && a.asset_id === v.asset_id);
  const parts: string[] = [];
  parts.push(`**${cve} — ${v.title}**`);
  parts.push("");
  parts.push(`Affects **${asset?.name ?? `asset #${v.asset_id}`}**${asset ? ` (${asset.asset_type}, criticality ${asset.criticality}/5${asset.internet_exposed ? ", internet-exposed" : ""})` : ""}.`);
  parts.push("");
  parts.push(`- **CVSS base:** ${v.cvss}/10 — the raw technical severity.`);
  parts.push(`- **Actively exploited:** ${v.known_exploited ? "✅ Yes — in CISA KEV, attacked in the wild (+1.5 risk)." : "No — not on CISA's KEV list."}`);
  parts.push(`- **EPSS:** ${v.epss_score != null ? `${(v.epss_score * 100).toFixed(0)}% likelihood of exploitation in the next 30 days.` : "not available."}`);
  if (alert) parts.push(`- **CRISP risk score:** ${alert.risk_score.toFixed(2)} → ${sevTag(alert.severity)} **${alert.severity}**, after applying criticality and exposure multipliers.`);
  parts.push("");
  parts.push(
    v.known_exploited
      ? "**Recommendation:** patch or isolate this now — it's being exploited in real attacks."
      : asset?.internet_exposed
        ? "**Recommendation:** prioritize because the host is internet-facing; the exposure multiplier inflates its real-world risk."
        : "**Recommendation:** schedule remediation by severity; no active exploitation lowers immediate urgency."
  );
  return parts.join("\n");
}

function summary(p: Posture, alerts: Alert[]): string {
  const totalRisk = alerts.reduce((s, a) => s + a.risk_score, 0);
  const value = estimateAle(totalRisk);
  const exposed = p.assets.filter((a) => a.internet_exposed).length;
  const exploited = p.vulns.filter((v) => v.known_exploited).length;
  const crit = alerts.filter((a) => a.severity === "CRITICAL").length;
  const high = alerts.filter((a) => a.severity === "HIGH").length;
  const top = rankedAlerts(p, alerts)[0];

  const lines = [
    `**Security posture at a glance:**`,
    "",
    `- **${p.assets.length} assets** (${exposed} internet-exposed)`,
    `- **${p.vulns.length} vulnerabilities** · ${exploited} actively exploited (KEV)`,
    `- **${alerts.length} active alerts** — ${crit} critical, ${high} high`,
    `- **Estimated ALE: ${eur(value)}**`,
  ];
  if (top) {
    lines.push("");
    lines.push(`Your single biggest concern is **${top.cve ?? top.title}** on *${assetName(p, top.asset_id)}* (risk ${top.risk_score.toFixed(1)}).`);
  }
  lines.push("");
  lines.push(`Ask me **"what should I fix first?"**, about your **internet-exposed** assets, **ROSI**, or paste a **CVE** to dig in.`);
  return lines.join("\n");
}
