// SSVC — Stakeholder-Specific Vulnerability Categorization (CISA's decision
// model). Derives the four decision points from a vulnerability + its asset and
// maps them to a prioritization decision: Act > Attend > Track* > Track.
// A modern alternative to triaging on raw CVSS alone.

import type { Vulnerability, Asset } from "./types";

export type Exploitation = "none" | "poc" | "active";
export type Exposure = "small" | "controlled" | "open";
export type Automatable = "no" | "yes";
export type Impact = "low" | "medium" | "high";
export type Decision = "Act" | "Attend" | "Track*" | "Track";

export interface SsvcAssessment {
  exploitation: Exploitation;
  exposure: Exposure;
  automatable: Automatable;
  impact: Impact;
  decision: Decision;
  priority: number; // 0 = most urgent
}

export const DECISION_META: Record<Decision, { label: string; blurb: string; color: string; cls: string }> = {
  Act: { label: "Act", blurb: "Remediate immediately / out-of-cycle", color: "#ef4444", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  Attend: { label: "Attend", blurb: "Remediate sooner than usual", color: "#f97316", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  "Track*": { label: "Track*", blurb: "Monitor closely, act if it escalates", color: "#eab308", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  Track: { label: "Track", blurb: "Standard remediation timeline", color: "#22c55e", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
};

const PRIORITY: Record<Decision, number> = { Act: 0, Attend: 1, "Track*": 2, Track: 3 };

function deriveExploitation(v: Vulnerability): Exploitation {
  if (v.known_exploited) return "active";
  if ((v.epss_score ?? 0) >= 0.1) return "poc";
  return "none";
}

function deriveExposure(asset: Asset | undefined): Exposure {
  if (asset?.internet_exposed) return "open";
  if (asset && asset.criticality <= 2) return "small";
  return "controlled";
}

function deriveAutomatable(v: Vulnerability): Automatable {
  return v.known_exploited || (v.epss_score ?? 0) >= 0.5 ? "yes" : "no";
}

function deriveImpact(v: Vulnerability, asset: Asset | undefined): Impact {
  const crit = asset?.criticality ?? 3;
  if (crit >= 4 || (v.cvss >= 9 && crit >= 3)) return "high";
  if (crit === 3 || v.cvss >= 7) return "medium";
  return "low";
}

// Simplified CISA SSVC deployer decision tree.
function decide(e: Exploitation, x: Exposure, a: Automatable, i: Impact): Decision {
  if (e === "active") {
    if (i === "high") return x === "open" ? "Act" : "Attend";
    if (i === "medium") return x === "open" ? "Attend" : "Track*";
    return x === "open" ? "Attend" : "Track*";
  }
  if (e === "poc") {
    if (i === "high") return x === "open" || a === "yes" ? "Attend" : "Track*";
    if (i === "medium") return x === "open" && a === "yes" ? "Attend" : "Track*";
    return "Track";
  }
  // exploitation === none
  if (i === "high" && x === "open" && a === "yes") return "Track*";
  return "Track";
}

export function assess(v: Vulnerability, asset: Asset | undefined): SsvcAssessment {
  const exploitation = deriveExploitation(v);
  const exposure = deriveExposure(asset);
  const automatable = deriveAutomatable(v);
  const impact = deriveImpact(v, asset);
  const decision = decide(exploitation, exposure, automatable, impact);
  return { exploitation, exposure, automatable, impact, decision, priority: PRIORITY[decision] };
}
