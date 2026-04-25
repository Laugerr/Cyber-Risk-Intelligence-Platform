import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ data: asset, error: ae }, { data: vulns, error: ve }, { data: alerts, error: ale }] = await Promise.all([
    supabase.from("assets").select("*").eq("id", Number(id)).single(),
    supabase.from("vulnerabilities").select("*").eq("asset_id", Number(id)).order("cvss", { ascending: false }),
    supabase.from("alerts").select("*").eq("asset_id", Number(id)).order("risk_score", { ascending: false }),
  ]);
  if (ae) return NextResponse.json({ error: ae.message }, { status: 404 });
  if (ve || ale) return NextResponse.json({ error: "Failed to load related data" }, { status: 500 });
  return NextResponse.json({ asset, vulns: vulns ?? [], alerts: alerts ?? [] });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { error } = await supabase.from("assets").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
