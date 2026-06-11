import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { FRAMEWORKS, autoStatus } from "@/lib/frameworks";
import type { Control, ComplianceStatus } from "@/lib/types";

export const runtime = "nodejs";

// GET — return all saved compliance statuses.
export async function GET() {
  const { data, error } = await supabase.from("compliance_status").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// PATCH — upsert a single requirement's status/note.
export async function PATCH(req: Request) {
  const body: ComplianceStatus = await req.json();
  if (!body.framework || !body.requirement_id) {
    return NextResponse.json({ error: "framework and requirement_id are required" }, { status: 400 });
  }
  const { error } = await supabase.from("compliance_status").upsert(
    {
      framework: body.framework,
      requirement_id: body.requirement_id,
      status: body.status,
      note: body.note ?? "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "framework,requirement_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST — auto-assess every framework requirement from the org's security
// controls (keyword match), upserting a status for each. One-click baseline.
export async function POST() {
  try {
    const { data: controls } = await supabase.from("controls").select("name, notes");
    const controlText = (controls ?? []).map(
      (c: Pick<Control, "name" | "notes">) => `${c.name} ${c.notes}`.toLowerCase()
    );

    const rows = FRAMEWORKS.flatMap((fw) =>
      fw.requirements.map((req) => ({
        framework: fw.id,
        requirement_id: req.id,
        status: autoStatus(req, controlText),
        note: "",
        updated_at: new Date().toISOString(),
      }))
    );

    const { error } = await supabase
      .from("compliance_status")
      .upsert(rows, { onConflict: "framework,requirement_id" });
    if (error) throw error;

    const met = rows.filter((r) => r.status === "met").length;
    return NextResponse.json({ assessed: rows.length, met });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
