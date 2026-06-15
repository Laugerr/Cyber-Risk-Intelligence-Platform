import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// GET — recent notifications (newest first) + unread count.
export async function GET() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = data ?? [];
  return NextResponse.json({ items, unread: items.filter((n) => !n.read).length });
}

// PATCH — mark one ({ id }) or all ({ all: true }) as read.
export async function PATCH(req: Request) {
  const body = await req.json();
  let q = supabase.from("notifications").update({ read: true });
  q = body.all ? q.eq("read", false) : q.eq("id", Number(body.id));
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE — clear all (or ?id= one).
export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  const q = id
    ? supabase.from("notifications").delete().eq("id", Number(id))
    : supabase.from("notifications").delete().neq("id", 0);
  const { error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
