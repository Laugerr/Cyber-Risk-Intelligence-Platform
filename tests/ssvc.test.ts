import { describe, it, expect } from "vitest";
import { assess } from "../lib/ssvc";
import type { Vulnerability, Asset } from "../lib/types";

const asset = (over: Partial<Asset>): Asset => ({
  id: 1, name: "a", asset_type: "Server", owner: "IT", criticality: 3, internet_exposed: false, ...over,
});
const vuln = (over: Partial<Vulnerability>): Vulnerability => ({
  asset_id: 1, cve: "CVE-X", title: "t", cvss: 7, known_exploited: false, epss_score: 0, ...over,
});

describe("SSVC assess", () => {
  it("returns Act for an actively-exploited, exposed, high-impact vuln", () => {
    const a = assess(vuln({ known_exploited: true, cvss: 9.8, epss_score: 0.9 }), asset({ criticality: 5, internet_exposed: true }));
    expect(a.exploitation).toBe("active");
    expect(a.exposure).toBe("open");
    expect(a.impact).toBe("high");
    expect(a.decision).toBe("Act");
    expect(a.priority).toBe(0);
  });

  it("returns Track for a non-exploited, low-impact, internal vuln", () => {
    const a = assess(vuln({ known_exploited: false, cvss: 4, epss_score: 0 }), asset({ criticality: 2, internet_exposed: false }));
    expect(a.exploitation).toBe("none");
    expect(a.decision).toBe("Track");
    expect(a.priority).toBe(3);
  });

  it("derives PoC exploitation from a moderate EPSS score", () => {
    const a = assess(vuln({ known_exploited: false, epss_score: 0.2 }), asset({}));
    expect(a.exploitation).toBe("poc");
  });

  it("orders decisions by urgency (Act < Attend < Track* < Track)", () => {
    const act = assess(vuln({ known_exploited: true, cvss: 10 }), asset({ criticality: 5, internet_exposed: true }));
    const track = assess(vuln({ epss_score: 0 }), asset({ criticality: 1 }));
    expect(act.priority).toBeLessThan(track.priority);
  });
});
