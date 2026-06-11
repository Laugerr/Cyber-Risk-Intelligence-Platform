// Curated compliance framework catalogs (NIST CSF 2.0, CIS Controls v8,
// ISO/IEC 27001:2022 Annex A) used by the Compliance Mapping page. Requirement
// `keywords` drive auto-assessment against the org's named security controls.

export type FrameworkId = "nist-csf" | "cis-v8" | "iso-27001";
export type CompStatus = "met" | "partial" | "gap" | "na";

export interface Requirement {
  id: string;
  category: string;
  title: string;
  keywords: string[];
}

export interface Framework {
  id: FrameworkId;
  name: string;
  short: string;
  version: string;
  reference: string;
  requirements: Requirement[];
}

export const FRAMEWORKS: Framework[] = [
  {
    id: "nist-csf",
    name: "NIST Cybersecurity Framework",
    short: "NIST CSF",
    version: "2.0",
    reference: "NIST CSF 2.0 Functions & Categories",
    requirements: [
      { id: "GV.OC", category: "Govern", title: "Organizational Context", keywords: [] },
      { id: "GV.RM", category: "Govern", title: "Risk Management Strategy", keywords: ["rosi", "risk management"] },
      { id: "GV.RR", category: "Govern", title: "Roles, Responsibilities & Authorities", keywords: [] },
      { id: "ID.AM", category: "Identify", title: "Asset Management", keywords: ["asset", "inventory"] },
      { id: "ID.RA", category: "Identify", title: "Risk Assessment", keywords: ["vulnerability", "risk", "patch"] },
      { id: "ID.IM", category: "Identify", title: "Improvement", keywords: [] },
      { id: "PR.AA", category: "Protect", title: "Identity Management & Access Control", keywords: ["mfa", "access", "authentication", "identity"] },
      { id: "PR.AT", category: "Protect", title: "Awareness & Training", keywords: ["training", "awareness"] },
      { id: "PR.DS", category: "Protect", title: "Data Security", keywords: ["encryption", "data", "backup"] },
      { id: "PR.PS", category: "Protect", title: "Platform Security", keywords: ["patch", "hardening", "configuration", "waf", "web application firewall"] },
      { id: "PR.IR", category: "Protect", title: "Technology Infrastructure Resilience", keywords: ["segmentation", "network", "zero-trust", "firewall"] },
      { id: "DE.CM", category: "Detect", title: "Continuous Monitoring", keywords: ["edr", "endpoint", "detection", "monitoring", "siem"] },
      { id: "DE.AE", category: "Detect", title: "Adverse Event Analysis", keywords: ["detection", "response", "edr"] },
      { id: "RS.MA", category: "Respond", title: "Incident Management", keywords: ["incident", "response"] },
      { id: "RS.MI", category: "Respond", title: "Incident Mitigation", keywords: ["edr", "containment", "isolation"] },
      { id: "RC.RP", category: "Recover", title: "Incident Recovery Plan Execution", keywords: ["backup", "recovery", "restore"] },
      { id: "RC.CO", category: "Recover", title: "Incident Recovery Communication", keywords: [] },
    ],
  },
  {
    id: "cis-v8",
    name: "CIS Critical Security Controls",
    short: "CIS Controls",
    version: "v8",
    reference: "CIS Controls v8",
    requirements: [
      { id: "CIS 1", category: "Asset & Data", title: "Inventory & Control of Enterprise Assets", keywords: ["asset", "inventory"] },
      { id: "CIS 2", category: "Asset & Data", title: "Inventory & Control of Software Assets", keywords: ["software", "inventory"] },
      { id: "CIS 3", category: "Asset & Data", title: "Data Protection", keywords: ["data", "encryption"] },
      { id: "CIS 4", category: "Access & Config", title: "Secure Configuration of Assets & Software", keywords: ["configuration", "hardening", "patch"] },
      { id: "CIS 5", category: "Access & Config", title: "Account Management", keywords: ["mfa", "account", "identity"] },
      { id: "CIS 6", category: "Access & Config", title: "Access Control Management", keywords: ["mfa", "access", "authentication"] },
      { id: "CIS 7", category: "Defense & Monitoring", title: "Continuous Vulnerability Management", keywords: ["vulnerability", "patch"] },
      { id: "CIS 8", category: "Defense & Monitoring", title: "Audit Log Management", keywords: ["log", "audit", "siem"] },
      { id: "CIS 9", category: "Defense & Monitoring", title: "Email & Web Browser Protections", keywords: ["waf", "web application firewall", "email"] },
      { id: "CIS 10", category: "Defense & Monitoring", title: "Malware Defenses", keywords: ["edr", "endpoint", "malware", "antivirus"] },
      { id: "CIS 11", category: "Asset & Data", title: "Data Recovery", keywords: ["backup", "recovery", "restore"] },
      { id: "CIS 12", category: "Defense & Monitoring", title: "Network Infrastructure Management", keywords: ["segmentation", "network", "firewall"] },
      { id: "CIS 13", category: "Defense & Monitoring", title: "Network Monitoring & Defense", keywords: ["edr", "detection", "monitoring", "ids"] },
      { id: "CIS 14", category: "Governance & Response", title: "Security Awareness & Skills Training", keywords: ["training", "awareness"] },
      { id: "CIS 16", category: "Defense & Monitoring", title: "Application Software Security", keywords: ["waf", "web application firewall", "appsec"] },
      { id: "CIS 17", category: "Governance & Response", title: "Incident Response Management", keywords: ["incident", "response"] },
      { id: "CIS 18", category: "Governance & Response", title: "Penetration Testing", keywords: ["pentest", "penetration"] },
    ],
  },
  {
    id: "iso-27001",
    name: "ISO/IEC 27001 Annex A",
    short: "ISO 27001",
    version: "2022",
    reference: "ISO/IEC 27001:2022 Annex A",
    requirements: [
      { id: "A.5.1", category: "Organizational", title: "Policies for Information Security", keywords: [] },
      { id: "A.5.7", category: "Organizational", title: "Threat Intelligence", keywords: ["threat intel", "kev", "epss"] },
      { id: "A.5.15", category: "Organizational", title: "Access Control", keywords: ["mfa", "access", "authentication"] },
      { id: "A.5.16", category: "Organizational", title: "Identity Management", keywords: ["mfa", "identity"] },
      { id: "A.5.23", category: "Organizational", title: "Information Security for Cloud Services", keywords: ["cloud"] },
      { id: "A.5.24", category: "Organizational", title: "Incident Management Planning", keywords: ["incident", "response"] },
      { id: "A.6.3", category: "People", title: "Security Awareness & Training", keywords: ["training", "awareness"] },
      { id: "A.7.1", category: "Physical", title: "Physical Security Perimeters", keywords: ["physical"] },
      { id: "A.8.2", category: "Technological", title: "Privileged Access Rights", keywords: ["mfa", "privileged", "access"] },
      { id: "A.8.7", category: "Technological", title: "Protection Against Malware", keywords: ["edr", "endpoint", "malware", "antivirus"] },
      { id: "A.8.8", category: "Technological", title: "Management of Technical Vulnerabilities", keywords: ["vulnerability", "patch"] },
      { id: "A.8.13", category: "Technological", title: "Information Backup", keywords: ["backup", "recovery"] },
      { id: "A.8.15", category: "Technological", title: "Logging", keywords: ["log", "audit", "siem"] },
      { id: "A.8.16", category: "Technological", title: "Monitoring Activities", keywords: ["edr", "monitoring", "detection"] },
      { id: "A.8.20", category: "Technological", title: "Networks Security", keywords: ["segmentation", "network", "firewall"] },
      { id: "A.8.23", category: "Technological", title: "Web Filtering", keywords: ["waf", "web application firewall", "web filter"] },
      { id: "A.8.25", category: "Technological", title: "Secure Development Life Cycle", keywords: ["sdlc", "secure development", "appsec"] },
    ],
  },
];

export function getFramework(id: string): Framework | undefined {
  return FRAMEWORKS.find((f) => f.id === id);
}

const STATUS_WEIGHT: Record<CompStatus, number> = { met: 1, partial: 0.5, gap: 0, na: 0 };

// Coverage % = (Σ status weight) / (applicable requirements) — N/A excluded.
export function coveragePct(statuses: CompStatus[]): number {
  const applicable = statuses.filter((s) => s !== "na");
  if (applicable.length === 0) return 0;
  const score = applicable.reduce((sum, s) => sum + STATUS_WEIGHT[s], 0);
  return Math.round((score / applicable.length) * 100);
}

// Suggest a status for a requirement by matching its keywords against the
// names/notes of the org's security controls.
export function autoStatus(req: Requirement, controlText: string[]): CompStatus {
  if (req.keywords.length === 0) return "gap";
  const hit = controlText.some((t) => req.keywords.some((k) => t.includes(k)));
  return hit ? "met" : "gap";
}
