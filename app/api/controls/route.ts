import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Control } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabase
    .from("controls")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body: Control = await req.json();
  const { data, error } = await supabase
    .from("controls")
    .insert({
      name: body.name,
      annual_cost_eur: body.annual_cost_eur,
      effectiveness_pct: body.effectiveness_pct,
      notes: body.notes,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
