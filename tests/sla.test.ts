import { describe, it, expect } from "vitest";
import { buildItems } from "../lib/sla";
import type { Asset, Vulnerability, Alert, Severity } from "../lib/types";

const DAY = 86_400_000;
const now = Date.now();
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

const policy: Record<Severity, number> = { CRITICAL: 7, HIGH: 30, MEDIUM: 90, LOW: 180 };

const assets: Asset[] = [
  { id: 1, name: "web", asset_type: "WebApp", owner: "IT", criticality: 5, internet_exposed: true },
];

const alert = (cve: string, severity: Severity): Alert => ({
  id: Math.random(), severity, title: cve, asset_id: 1, cve, risk_score: 20, evidence: "",
});

describe("buildItems (SLA state)", () => {
  it("marks an overdue, unresolved critical vuln as breached", () => {
    const vulns: Vulnerability[] = [
      { id: 1, asset_id: 1, cve: "CVE-1", title: "t", cvss: 9, known_exploited: true, status: "open", detected_at: iso(100) },
    ];
    const [item] = buildItems(vulns, assets, [alert("CVE-1", "CRITICAL")], policy);
    expect(item.severity).toBe("CRITICAL");
    expect(item.sla_state).toBe("breached");
    expect(item.days_remaining).toBeLessThan(0);
  });

  it("marks a freshly-detected vuln as on track", () => {
    const vulns: Vulnerability[] = [
      { id: 2, asset_id: 1, cve: "CVE-2", title: "t", cvss: 9, known_exploited: false, status: "open", detected_at: iso(1) },
    ];
    const [item] = buildItems(vulns, assets, [alert("CVE-2", "HIGH")], policy);
    expect(item.sla_state).toBe("on_track");
  });

  it("classifies resolved vulns as met or missed by their resolved_at", () => {
    const vulns: Vulnerability[] = [
      { id: 3, asset_id: 1, cve: "CVE-3", title: "t", cvss: 9, known_exploited: true, status: "resolved", detected_at: iso(50), resolved_at: iso(48) }, // within 7d → met
      { id: 4, asset_id: 1, cve: "CVE-4", title: "t", cvss: 9, known_exploited: true, status: "resolved", detected_at: iso(50), resolved_at: iso(40) }, // 10d → missed
    ];
    const items = buildItems(vulns, assets, [alert("CVE-3", "CRITICAL"), alert("CVE-4", "CRITICAL")], policy);
    expect(items.find((i) => i.cve === "CVE-3")?.sla_state).toBe("met");
    expect(items.find((i) => i.cve === "CVE-4")?.sla_state).toBe("missed");
  });

  it("falls back to computed severity when no alert exists", () => {
    const vulns: Vulnerability[] = [
      { id: 5, asset_id: 1, cve: "CVE-5", title: "t", cvss: 9, known_exploited: false, status: "open", detected_at: iso(1) },
    ];
    const [item] = buildItems(vulns, assets, [], policy);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(item.severity);
  });
});
