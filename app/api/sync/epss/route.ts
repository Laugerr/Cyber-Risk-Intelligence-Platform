import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() { return handler(); }
export async function POST() { return handler(); }

async function handler() {
  try {
    const { data: vulns } = await supabase.from("vulnerabilities").select("id, cve");
    if (!vulns || vulns.length === 0) return NextResponse.json({ updated: 0 });

    const cveIds = [...new Set(vulns.map((v: { cve: string }) => v.cve.trim().toUpperCase()))];
    const CHUNK = 100;
    const scoreMap: Record<string, number> = {};

    for (let i = 0; i < cveIds.length; i += CHUNK) {
      const batch = cveIds.slice(i, i + CHUNK);
      const url = `https://api.first.org/data/v1/epss?cve=${batch.join(",")}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      for (const item of json.data || []) {
        const cve = (item.cve || "").trim().toUpperCase();
        const score = parseFloat(item.epss);
        if (cve && !isNaN(score)) scoreMap[cve] = score;
      }
    }

    let updated = 0;
    for (const vuln of vulns) {
      const score = scoreMap[vuln.cve.trim().toUpperCase()];
      if (score !== undefined) {
        await supabase.from("vulnerabilities").update({ epss_score: score }).eq("id", vuln.id);
        updated++;
      }
    }

    return NextResponse.json({ updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
