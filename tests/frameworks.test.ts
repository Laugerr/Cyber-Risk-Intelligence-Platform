import { describe, it, expect } from "vitest";
import { FRAMEWORKS, getFramework, coveragePct, autoStatus, type Requirement } from "../lib/frameworks";

describe("coveragePct", () => {
  it("is 100 when everything is met and 0 when all gaps", () => {
    expect(coveragePct(["met", "met", "met"])).toBe(100);
    expect(coveragePct(["gap", "gap"])).toBe(0);
  });
  it("weights partial as half", () => {
    expect(coveragePct(["met", "gap"])).toBe(50);
    expect(coveragePct(["partial", "partial"])).toBe(50);
  });
  it("excludes N/A from the denominator", () => {
    expect(coveragePct(["met", "na"])).toBe(100);
    expect(coveragePct(["na", "na"])).toBe(0);
  });
});

describe("autoStatus", () => {
  const req: Requirement = { id: "PR.AA", category: "Protect", title: "Access", keywords: ["mfa", "access"] };
  it("returns met when a control matches a keyword", () => {
    expect(autoStatus(req, ["mfa enforcement across all accounts"])).toBe("met");
  });
  it("returns gap when nothing matches", () => {
    expect(autoStatus(req, ["network segmentation"])).toBe("gap");
  });
  it("returns gap for requirements with no keywords", () => {
    expect(autoStatus({ ...req, keywords: [] }, ["mfa"])).toBe("gap");
  });
});

describe("framework catalogs", () => {
  it("exposes the three expected frameworks", () => {
    expect(FRAMEWORKS.map((f) => f.id).sort()).toEqual(["cis-v8", "iso-27001", "nist-csf"]);
  });
  it("has non-empty, uniquely-identified requirements per framework", () => {
    for (const fw of FRAMEWORKS) {
      expect(fw.requirements.length).toBeGreaterThan(0);
      const ids = fw.requirements.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
  it("getFramework resolves by id", () => {
    expect(getFramework("nist-csf")?.short).toBe("NIST CSF");
    expect(getFramework("nope")).toBeUndefined();
  });
});
