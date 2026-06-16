import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { makeCpe } from "@/lib/cve-feed";
import { logAudit } from "@/lib/audit";
import type { AssetType, Asset } from "@/lib/types";

export const runtime = "nodejs";

const ASSET_TYPES: AssetType[] = ["Server", "Workstation", "Cloud", "Network", "WebApp", "Database", "Other"];

function asBool(v: string): boolean {
  return ["true", "yes", "1", "y"].includes((v ?? "").toLowerCase().trim());
}

// POST — bulk import rows parsed from CSV. Body: { type, rows: Record<string,string>[] }
export async function POST(req: Request) {
  try {
    const { type, rows } = (await req.json()) as { type: string; rows: Record<string, string>[] };
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }

    if (type === "assets") {
      const toInsert = rows
        .filter((r) => (r.name ?? "").trim())
        .map((r) => {
          const t = (r.asset_type ?? "Other").trim();
          const crit = Math.max(1, Math.min(5, parseInt(r.criticality, 10) || 3));
          return {
            name: r.name.trim(),
            asset_type: (ASSET_TYPES.includes(t as AssetType) ? t : "Other") as AssetType,
            owner: (r.owner ?? "IT").trim() || "IT",
            criticality: crit,
            internet_exposed: asBool(r.internet_exposed),
          };
        });
      if (toInsert.length === 0) return NextResponse.json({ error: "No valid asset rows (need a 'name' column)" }, { status: 400 });

      const { error } = await supabase.from("assets").insert(toInsert);
      if (error) throw error;
      await logAudit({ action: "import", entity: "asset", entity_ref: `${toInsert.length} assets`, summary: `Imported ${toInsert.length} assets from CSV` });
      return NextResponse.json({ imported: toInsert.length, skipped: rows.length - toInsert.length });
    }

    if (type === "software") {
      const { data: assets } = await supabase.from("assets").select("id, name");
      const byName = new Map((assets ?? []).map((a: Pick<Asset, "id" | "name">) => [a.name.toLowerCase(), a.id]));
      const toInsert = rows
        .map((r) => {
          const assetId = byName.get((r.asset ?? r.asset_name ?? "").toLowerCase().trim());
          if (!assetId || !(r.product ?? "").trim()) return null;
          const vendor = (r.vendor ?? "").trim();
          const product = r.product.trim();
          const version = (r.version ?? "").trim();
          return { asset_id: assetId, vendor, product, version, cpe: makeCpe(vendor, product, version) };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      if (toInsert.length === 0) return NextResponse.json({ error: "No valid software rows (need 'asset' matching an existing asset name, and 'product')" }, { status: 400 });

      const { error } = await supabase.from("asset_software").insert(toInsert);
      if (error) throw error;
      await logAudit({ action: "import", entity: "software", entity_ref: `${toInsert.length} components`, summary: `Imported ${toInsert.length} software components from CSV` });
      return NextResponse.json({ imported: toInsert.length, skipped: rows.length - toInsert.length });
    }

    return NextResponse.json({ error: `Unsupported import type: ${type}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
