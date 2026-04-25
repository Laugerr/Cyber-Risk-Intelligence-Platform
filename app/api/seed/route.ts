import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const ASSETS = [
  { name: "prod-web-01", asset_type: "WebApp", owner: "Platform Team", criticality: 5, internet_exposed: true },
  { name: "prod-db-primary", asset_type: "Database", owner: "DBA Team", criticality: 5, internet_exposed: false },
  { name: "corp-ad-dc01", asset_type: "Server", owner: "IT Operations", criticality: 5, internet_exposed: false },
  { name: "vpn-gateway-01", asset_type: "Network", owner: "Network Team", criticality: 4, internet_exposed: true },
  { name: "mail-server-01", asset_type: "Server", owner: "IT Operations", criticality: 4, internet_exposed: true },
  { name: "dev-api-gateway", asset_type: "Cloud", owner: "DevOps Team", criticality: 3, internet_exposed: true },
  { name: "backup-server-01", asset_type: "Server", owner: "IT Operations", criticality: 4, internet_exposed: false },
  { name: "hr-workstation-12", asset_type: "Workstation", owner: "HR Department", criticality: 2, internet_exposed: false },
];

const VULNS = [
  { asset: "prod-web-01", cve: "CVE-2021-44228", title: "Apache Log4j2 Remote Code Execution (Log4Shell)", cvss: 10.0, known_exploited: true, epss_score: 0.975 },
  { asset: "prod-web-01", cve: "CVE-2022-26134", title: "Atlassian Confluence Server OGNL Injection RCE", cvss: 9.8, known_exploited: true, epss_score: 0.974 },
  { asset: "corp-ad-dc01", cve: "CVE-2021-34527", title: "Windows Print Spooler RCE (PrintNightmare)", cvss: 8.8, known_exploited: true, epss_score: 0.962 },
  { asset: "corp-ad-dc01", cve: "CVE-2020-1472", title: "Netlogon Privilege Escalation (Zerologon)", cvss: 10.0, known_exploited: true, epss_score: 0.971 },
  { asset: "vpn-gateway-01", cve: "CVE-2024-3400", title: "PAN-OS GlobalProtect OS Command Injection", cvss: 10.0, known_exploited: true, epss_score: 0.969 },
  { asset: "vpn-gateway-01", cve: "CVE-2023-20198", title: "Cisco IOS XE Web UI Privilege Escalation", cvss: 10.0, known_exploited: true, epss_score: 0.966 },
  { asset: "mail-server-01", cve: "CVE-2023-23397", title: "Microsoft Outlook Privilege Escalation via NTLM Hash", cvss: 9.8, known_exploited: true, epss_score: 0.944 },
  { asset: "mail-server-01", cve: "CVE-2022-30190", title: "Microsoft Windows MSDT RCE (Follina)", cvss: 7.8, known_exploited: true, epss_score: 0.936 },
  { asset: "prod-db-primary", cve: "CVE-2022-1388", title: "F5 BIG-IP iControl REST Authentication Bypass", cvss: 9.8, known_exploited: true, epss_score: 0.973 },
  { asset: "prod-db-primary", cve: "CVE-2023-44487", title: "HTTP/2 Rapid Reset DDoS Attack", cvss: 7.5, known_exploited: true, epss_score: 0.706 },
  { asset: "dev-api-gateway", cve: "CVE-2022-22965", title: "Spring Framework RCE via Data Binding (Spring4Shell)", cvss: 9.8, known_exploited: true, epss_score: 0.951 },
  { asset: "dev-api-gateway", cve: "CVE-2021-26084", title: "Atlassian Confluence Server OGNL Injection", cvss: 9.8, known_exploited: true, epss_score: 0.974 },
  { asset: "backup-server-01", cve: "CVE-2023-34362", title: "Progress MOVEit Transfer SQL Injection", cvss: 9.8, known_exploited: true, epss_score: 0.962 },
  { asset: "hr-workstation-12", cve: "CVE-2023-36884", title: "Windows Search Remote Code Execution", cvss: 8.3, known_exploited: true, epss_score: 0.878 },
  { asset: "prod-web-01", cve: "CVE-2024-21762", title: "Fortinet FortiOS SSL VPN Out-of-Bound Write", cvss: 9.6, known_exploited: true, epss_score: 0.912 },
];

const CONTROLS = [
  { name: "MFA Enforcement", annual_cost_eur: 15000, effectiveness_pct: 40, notes: "Enforce MFA across all user accounts and privileged access" },
  { name: "Patch Management Program", annual_cost_eur: 25000, effectiveness_pct: 35, notes: "Automated patch deployment within 14 days of critical releases" },
  { name: "Web Application Firewall (WAF)", annual_cost_eur: 20000, effectiveness_pct: 30, notes: "Deployed on all internet-facing web applications" },
  { name: "Endpoint Detection & Response (EDR)", annual_cost_eur: 35000, effectiveness_pct: 45, notes: "CrowdStrike Falcon deployed on all endpoints and servers" },
  { name: "Network Segmentation", annual_cost_eur: 50000, effectiveness_pct: 50, notes: "Zero-trust micro-segmentation between critical zones" },
];

export async function POST() {
  try {
    // Clear existing data
    await supabase.from("alerts").delete().neq("id", 0);
    await supabase.from("vulnerabilities").delete().neq("id", 0);
    await supabase.from("controls").delete().neq("id", 0);
    await supabase.from("assets").delete().neq("id", 0);

    // Insert assets
    const { data: insertedAssets, error: assetError } = await supabase
      .from("assets")
      .insert(ASSETS)
      .select();
    if (assetError) throw assetError;

    const assetMap = Object.fromEntries(insertedAssets.map((a: { name: string; id: number }) => [a.name, a.id]));

    // Insert vulnerabilities + auto-alerts
    for (const v of VULNS) {
      const assetId = assetMap[v.asset];
      if (!assetId) continue;

      const { data: vuln } = await supabase
        .from("vulnerabilities")
        .insert({
          asset_id: assetId,
          cve: v.cve,
          title: v.title,
          cvss: v.cvss,
          known_exploited: v.known_exploited,
          epss_score: v.epss_score,
        })
        .select()
        .single();

      if (!vuln) continue;

      const asset = ASSETS.find((a) => a.name === v.asset);
      if (!asset) continue;

      const critFactor = 1.0 + (asset.criticality - 1) * 0.15;
      const expFactor = asset.internet_exposed ? 1.3 : 1.0;
      const exploitBonus = v.known_exploited ? 0.5 : 0;
      const kevBonus = 1.5;
      const epss = v.epss_score ?? 0;
      const epssBonus = epss >= 0.9 ? 1.5 : epss >= 0.7 ? 1.1 : epss >= 0.4 ? 0.7 : 0;
      const score = Math.round((v.cvss * critFactor * expFactor + exploitBonus + kevBonus + epssBonus) * 100) / 100;
      const severity = score >= 12 ? "CRITICAL" : score >= 9 ? "HIGH" : score >= 5 ? "MEDIUM" : "LOW";

      await supabase.from("alerts").insert({
        severity,
        title: `${v.cve}: ${v.title}`,
        asset_id: assetId,
        cve: v.cve,
        risk_score: score,
        evidence: `CVSS=${v.cvss} | KEV=true | EPSS=${v.epss_score}`,
      });
    }

    // Insert controls
    await supabase.from("controls").insert(CONTROLS);

    return NextResponse.json({ success: true, assets: ASSETS.length, vulns: VULNS.length, controls: CONTROLS.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
