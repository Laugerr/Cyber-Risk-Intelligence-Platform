import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { NotificationSettings } from "@/lib/types";

export const runtime = "nodejs";

const DEFAULTS: NotificationSettings = {
  id: 1,
  enabled: true,
  webhook_url: "",
  notify_kev: true,
  notify_critical: true,
  notify_sla: true,
};

export async function GET() {
  const { data } = await supabase.from("notification_settings").select("*").eq("id", 1).single();
  return NextResponse.json(data ?? DEFAULTS);
}

export async function PATCH(req: Request) {
  const body: Partial<NotificationSettings> = await req.json();
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ id: 1, ...body }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// POST — send a test message to the configured webhook.
export async function POST() {
  const { data } = await supabase.from("notification_settings").select("*").eq("id", 1).single();
  const url = data?.webhook_url?.trim();
  if (!url) return NextResponse.json({ error: "No webhook URL configured." }, { status: 400 });
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "🛡️ CRISP test notification — your integration is working.",
        source: "CRISP",
        type: "test",
      }),
    });
    if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
