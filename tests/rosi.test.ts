import { describe, it, expect } from "vitest";
import { estimateAle, calculateRosi } from "../lib/rosi";

describe("estimateAle", () => {
  it("multiplies aggregate risk by €10,000", () => {
    expect(estimateAle(5)).toBe(50000);
    expect(estimateAle(0)).toBe(0);
    expect(estimateAle(12.5)).toBe(125000);
  });
});

describe("calculateRosi", () => {
  it("computes risk-reduction value and a positive ROSI when savings exceed cost", () => {
    const { riskReductionValue, rosi } = calculateRosi(100000, 20000, 40);
    expect(riskReductionValue).toBe(40000);
    expect(rosi).toBe(1); // (40000 - 20000) / 20000
  });

  it("returns a negative ROSI when the control costs more than it saves", () => {
    const { rosi } = calculateRosi(100000, 60000, 40); // saves 40k, costs 60k
    expect(rosi).toBeLessThan(0);
  });
});
