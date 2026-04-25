import type { RiskResult, Severity } from "./types";

export function calculateRisk(
  cvss: number,
  criticality: number,
  internetExposed: boolean,
  knownExploited: boolean,
  kev: boolean = false,
  epssScore?: number | null
): RiskResult {
  const criticalityFactor = 1.0 + (Math.max(1, Math.min(5, criticality)) - 1) * 0.15;
  const exposureFactor = internetExposed ? 1.3 : 1.0;
  const exploitedBonus = knownExploited ? 0.5 : 0.0;
  const kevBonus = kev ? 1.5 : 0.0;

  const normalizedEpss =
    epssScore == null ? 0.0 : Math.max(0.0, Math.min(1.0, epssScore));
  let epssBonus = 0.0;
  if (normalizedEpss >= 0.9) epssBonus = 1.5;
  else if (normalizedEpss >= 0.7) epssBonus = 1.1;
  else if (normalizedEpss >= 0.4) epssBonus = 0.7;
  else if (normalizedEpss >= 0.2) epssBonus = 0.35;

  const score = Math.round(
    (cvss * criticalityFactor * exposureFactor + exploitedBonus + kevBonus + epssBonus) * 100
  ) / 100;

  let severity: Severity;
  if (score >= 12) severity = "CRITICAL";
  else if (score >= 9) severity = "HIGH";
  else if (score >= 5) severity = "MEDIUM";
  else severity = "LOW";

  return { risk_score: score, severity, exploited_bonus: exploitedBonus, kev_bonus: kevBonus, epss_bonus: epssBonus };
}
