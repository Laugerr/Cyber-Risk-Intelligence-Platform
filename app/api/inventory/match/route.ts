import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CVE_FEED, matches } from "@/lib/cve-feed";
import { calculateRisk } from "@/lib/scoring";
import { logAudit } from "@/lib/audit";
import type { Asset, AssetSoftware, Vulnerability } from "@/lib/types";

export const runtime = "nodejs";

// POST — run automatic CVE→asset matching. For every advisory in the feed that
// matches an asset's software inventory and isn't already tracked, create the
// vulnerability and its risk alert. Idempotent: re-running links only new ones.
export async function POST() {
  try {
    const [swRes, assetsRes, vulnsRes] = await Promise.all([
      supabase.from("asset_software").select("*"),
      supabase.from("assets").select("*"),
      supabase.from("vulnerabilities").select("asset_id, cve"),
    ]);

    const software = (swRes.data ?? []) as AssetSoftware[];
    const assets = (assetsRes.data ?? []) as Asset[];
    const existing = new Set(
      ((vulnsRes.data ?? []) as Pick<Vulnerability, "asset_id" | "cve">[]).map((v) => `${v.asset_id}:${v.cve}`)
    );
    const assetById = new Map(assets.map((a) => [a.id, a]));

    let matchedPairs = 0;
    let created = 0;

    for (const adv of CVE_FEED) {
      const assetIds = new Set(software.filter((s) => matches(adv, s)).map((s) => s.asset_id));
      for (const assetId of assetIds) {
        matchedPairs++;
        const key = `${assetId}:${adv.cve}`;
        if (existing.has(key)) continue;
        existing.add(key); // guard against dupes within this run

        const { data: vuln } = await supabase
          .from("vulnerabilities")
          .insert({
            asset_id: assetId,
            cve: adv.cve,
            title: adv.title,
            cvss: adv.cvss,
            known_exploited: adv.known_exploited,
            epss_score: adv.epss_score,
          })
          .select()
          .single();
        if (!vuln) continue;
        created++;

        const asset = assetById.get(assetId);
        if (!asset) continue;
        const risk = calculateRisk(adv.cvss, asset.criticality, asset.internet_exposed, adv.known_exploited, adv.known_exploited, adv.epss_score);
        await supabase.from("alerts").insert({
          severity: risk.severity,
          title: `${adv.cve}: ${adv.title}`,
          asset_id: assetId,
          cve: adv.cve,
          risk_score: risk.risk_score,
          evidence: `Auto-matched via software inventory | CVSS=${adv.cvss} | KEV=${adv.known_exploited} | EPSS=${adv.epss_score}`,
        });
      }
    }

    if (created > 0) {
      await logAudit({ action: "match", entity: "vulnerability", entity_ref: `${created} CVEs`, summary: `Auto-matched ${created} new CVE${created > 1 ? "s" : ""} to assets via software inventory` });
    }
    return NextResponse.json({ matched_pairs: matchedPairs, created_vulns: created });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
