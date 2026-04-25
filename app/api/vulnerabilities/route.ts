import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { calculateRisk } from "@/lib/scoring";
import type { Vulnerability } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabase
    .from("vulnerabilities")
    .select("*")
    .order("detected_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body: Vulnerability = await req.json();

  const { data: vuln, error: vulnError } = await supabase
    .from("vulnerabilities")
    .insert({
      asset_id: body.asset_id,
      cve: body.cve.trim().toUpperCase(),
      title: body.title,
      cvss: body.cvss,
      known_exploited: body.known_exploited,
      epss_score: body.epss_score ?? null,
    })
    .select()
    .single();

  if (vulnError) return NextResponse.json({ error: vulnError.message }, { status: 500 });

  // Auto-generate alert
  const { data: asset } = await supabase
    .from("assets")
    .select("criticality, internet_exposed")
    .eq("id", body.asset_id)
    .single();

  if (asset) {
    const risk = calculateRisk(
      body.cvss,
      asset.criticality,
      asset.internet_exposed,
      body.known_exploited,
      false,
      body.epss_score
    );

    await supabase.from("alerts").insert({
      severity: risk.severity,
      title: `${body.cve}: ${body.title}`,
      asset_id: body.asset_id,
      cve: body.cve.trim().toUpperCase(),
      risk_score: risk.risk_score,
      evidence: `CVSS=${body.cvss} | Exploited=${body.known_exploited} | EPSS=${body.epss_score ?? "N/A"}`,
    });
  }

  return NextResponse.json(vuln, { status: 201 });
}
