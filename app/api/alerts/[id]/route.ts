import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { acknowledged } = body;
  const { error } = await supabase.from("alerts").update({ acknowledged }).eq("id", Number(id));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (acknowledged) {
    const { data: alert } = await supabase.from("alerts").select("cve, title").eq("id", Number(id)).single();
    await logAudit({ action: "acknowledge", entity: "alert", entity_ref: alert?.cve ?? `#${id}`, summary: `Alert acknowledged: ${alert?.title ?? id}` });
  }
  return NextResponse.json({ success: true });
}
