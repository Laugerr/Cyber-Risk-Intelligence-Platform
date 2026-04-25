export function estimateAle(totalRiskScore: number): number {
  return Math.round(totalRiskScore * 10000 * 100) / 100;
}

export function calculateRosi(
  aleBefore: number,
  controlCost: number,
  effectivenessPct: number
): { riskReductionValue: number; rosi: number } {
  const riskReductionValue = Math.round(aleBefore * (effectivenessPct / 100) * 100) / 100;
  const rosi = Math.round(((riskReductionValue - controlCost) / controlCost) * 100) / 100;
  return { riskReductionValue, rosi };
}
