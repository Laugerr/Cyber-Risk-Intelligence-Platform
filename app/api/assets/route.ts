import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Asset } from "@/lib/types";

export async function GET() {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body: Asset = await req.json();
  const { data, error } = await supabase
    .from("assets")
    .insert({
      name: body.name,
      asset_type: body.asset_type,
      owner: body.owner,
      criticality: body.criticality,
      internet_exposed: body.internet_exposed,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
