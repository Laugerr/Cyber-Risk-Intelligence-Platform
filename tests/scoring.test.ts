import { describe, it, expect } from "vitest";
import { calculateRisk } from "../lib/scoring";

describe("calculateRisk", () => {
  it("scores a low-impact, internal, non-exploited vuln as LOW", () => {
    const r = calculateRisk(2, 1, false, false, false, null);
    expect(r.risk_score).toBeCloseTo(2, 2);
    expect(r.severity).toBe("LOW");
  });

  it("maps the severity bands by score", () => {
    expect(calculateRisk(5, 1, false, false, false, 0).severity).toBe("MEDIUM"); // 5.0
    expect(calculateRisk(9, 1, false, false, false, 0).severity).toBe("HIGH"); // 9.0
    expect(calculateRisk(10, 5, true, true, true, 0.95).severity).toBe("CRITICAL");
  });

  it("applies criticality, exposure, KEV and EPSS bonuses", () => {
    // 10 * 1.6 (crit5) * 1.3 (exposed) + 0.5 (exploited) + 1.5 (kev) + 1.5 (epss>=0.9)
    const r = calculateRisk(10, 5, true, true, true, 0.95);
    expect(r.risk_score).toBeCloseTo(24.3, 1);
    expect(r.kev_bonus).toBe(1.5);
    expect(r.epss_bonus).toBe(1.5);
    expect(r.exploited_bonus).toBe(0.5);
  });

  it("adds the exposure multiplier only when internet-exposed", () => {
    const internal = calculateRisk(8, 3, false, false, false, 0);
    const exposed = calculateRisk(8, 3, true, false, false, 0);
    expect(exposed.risk_score).toBeGreaterThan(internal.risk_score);
  });

  it("clamps criticality and EPSS to valid ranges", () => {
    const high = calculateRisk(5, 99, false, false, false, 5);
    const max = calculateRisk(5, 5, false, false, false, 1);
    expect(high.risk_score).toBe(max.risk_score); // criticality clamps to 5, epss to 1
  });
});
