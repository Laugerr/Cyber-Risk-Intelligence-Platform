import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: vuln } = await supabase.from("vulnerabilities").select("cve").eq("id", Number(id)).single();
  const { error } = await supabase.from("vulnerabilities").delete().eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ action: "delete", entity: "vulnerability", entity_ref: vuln?.cve ?? `#${id}`, summary: `CVE ${vuln?.cve ?? id} removed` });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body;
  if (!["open", "in_progress", "resolved"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  // Stamp the remediation time when resolved; clear it if reopened (powers MTTR).
  const update: { status: string; resolved_at?: string | null } = { status };
  update.resolved_at = status === "resolved" ? new Date().toISOString() : null;
  const { error } = await supabase.from("vulnerabilities").update(update).eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: vuln } = await supabase.from("vulnerabilities").select("cve").eq("id", Number(id)).single();
  await logAudit({ action: "update", entity: "vulnerability", entity_ref: vuln?.cve ?? `#${id}`, summary: `CVE ${vuln?.cve ?? id} status → ${status.replace("_", " ")}` });
  return NextResponse.json({ success: true });
}
