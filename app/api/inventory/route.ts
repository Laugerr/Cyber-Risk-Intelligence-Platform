import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { CVE_FEED, matches, makeCpe } from "@/lib/cve-feed";
import type { Asset, AssetSoftware, Vulnerability } from "@/lib/types";

export const runtime = "nodejs";

// GET — software inventory (with asset names), the CVE feed, and a match preview
// showing which advisories hit which assets and whether they're already linked.
export async function GET() {
  const [swRes, assetsRes, vulnsRes] = await Promise.all([
    supabase.from("asset_software").select("*").order("id", { ascending: true }),
    supabase.from("assets").select("*"),
    supabase.from("vulnerabilities").select("asset_id, cve"),
  ]);

  const software = (swRes.data ?? []) as AssetSoftware[];
  const assets = (assetsRes.data ?? []) as Asset[];
  const vulns = (vulnsRes.data ?? []) as Pick<Vulnerability, "asset_id" | "cve">[];
  const assetById = new Map(assets.map((a) => [a.id, a]));
  const linked = new Set(vulns.map((v) => `${v.asset_id}:${v.cve}`));

  const softwareView = software.map((s) => ({ ...s, asset_name: assetById.get(s.asset_id)?.name ?? `asset #${s.asset_id}` }));

  let newMatches = 0;
  const preview = CVE_FEED.map((adv) => {
    const matched = software
      .filter((s) => matches(adv, s))
      .reduce((acc: { asset_id: number; asset_name: string; linked: boolean }[], s) => {
        if (acc.some((m) => m.asset_id === s.asset_id)) return acc; // dedupe per asset
        const isLinked = linked.has(`${s.asset_id}:${adv.cve}`);
        if (!isLinked) newMatches++;
        acc.push({ asset_id: s.asset_id, asset_name: assetById.get(s.asset_id)?.name ?? `asset #${s.asset_id}`, linked: isLinked });
        return acc;
      }, []);
    return { ...adv, matched };
  }).filter((a) => a.matched.length > 0);

  return NextResponse.json({
    software: softwareView,
    preview,
    summary: {
      total_software: software.length,
      assets_with_software: new Set(software.map((s) => s.asset_id)).size,
      feed_size: CVE_FEED.length,
      new_matches: newMatches,
    },
  });
}

// POST — add a software component to an asset (CPE auto-generated).
export async function POST(req: Request) {
  const body = await req.json();
  const { asset_id, vendor, product, version } = body;
  if (!asset_id || !product?.trim()) {
    return NextResponse.json({ error: "asset_id and product are required" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("asset_software")
    .insert({
      asset_id,
      vendor: (vendor ?? "").trim(),
      product: product.trim(),
      version: (version ?? "").trim(),
      cpe: makeCpe((vendor ?? "").trim(), product.trim(), (version ?? "").trim()),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// DELETE — remove a software component by ?id=
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const { error } = await supabase.from("asset_software").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
