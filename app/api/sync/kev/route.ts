import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() { return handler(); }
export async function POST() { return handler(); }

async function handler() {
  try {
    const res = await fetch(
      "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) throw new Error("KEV fetch failed");
    const payload = await res.json();
    const kevSet: Set<string> = new Set(
      (payload.vulnerabilities || [])
        .map((v: { cveID?: string }) => (v.cveID || "").trim().toUpperCase())
        .filter((id: string) => id.startsWith("CVE-"))
    );

    if (kevSet.size === 0) return NextResponse.json({ updated: 0 });

    const { data: vulns } = await supabase
      .from("vulnerabilities")
      .select("id, cve, known_exploited");

    let updated = 0;
    for (const vuln of vulns || []) {
      if (!vuln.known_exploited && kevSet.has(vuln.cve.trim().toUpperCase())) {
        await supabase
          .from("vulnerabilities")
          .update({ known_exploited: true })
          .eq("id", vuln.id);
        updated++;
      }
    }

    return NextResponse.json({ updated, kev_total: kevSet.size });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
