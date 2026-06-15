"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, RefreshCw, Check, Trash2, Send, Webhook, Zap, AlertTriangle, Clock } from "lucide-react";
import type { Notification, NotificationType, NotificationSettings } from "@/lib/types";
import { toast } from "sonner";

const PANEL = { background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" } as const;

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  kev: <Zap className="w-4 h-4 text-red-400" />,
  critical: <AlertTriangle className="w-4 h-4 text-red-400" />,
  sla_breach: <Clock className="w-4 h-4 text-orange-400" />,
  info: <Bell className="w-4 h-4 text-blue-400" />,
};

function timeAgo(iso?: string) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [n, s] = await Promise.all([
        fetch("/api/notifications").then((r) => r.json()),
        fetch("/api/notifications/settings").then((r) => r.json()),
      ]);
      setItems(Array.isArray(n.items) ? n.items : []);
      setSettings(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function scan() {
    setScanning(true);
    const t = toast.loading("Scanning for new security events…");
    try {
      const res = await fetch("/api/notifications/scan", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await load();
      toast.success(data.created > 0 ? `${data.created} new notification${data.created > 1 ? "s" : ""}` : "No new events", { id: t });
    } catch (err) {
      toast.error(`Failed: ${err}`, { id: t });
    } finally {
      setScanning(false);
    }
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }) });
  }

  async function clearAll() {
    setItems([]);
    await fetch("/api/notifications", { method: "DELETE" });
    toast.success("Notifications cleared");
  }

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/notifications/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      toast.success("Integration settings saved");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    const t = toast.loading("Sending test to webhook…");
    try {
      await saveSettings();
      const res = await fetch("/api/notifications/settings", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success("Test sent — check your webhook", { id: t });
    } catch (err) {
      toast.error(`${err}`, { id: t });
    }
  }

  function set<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Notifications &amp; Integrations</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Alerts on new KEV CVEs, critical risk, and SLA breaches — in-app and via webhook
          </p>
        </div>
        <Button onClick={scan} disabled={scanning} size="sm" className="gap-2 h-9">
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
          {scanning ? "Scanning…" : "Scan Now"}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full lg:col-span-2" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Settings */}
          <Card style={PANEL}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Webhook className="w-4 h-4 text-primary" /> Integration Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Toggle label="Webhook push enabled" checked={settings?.enabled ?? false} onChange={(v) => set("enabled", v)} />
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Webhook URL</label>
                <Input
                  value={settings?.webhook_url ?? ""}
                  onChange={(e) => set("webhook_url", e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                  className="h-9 mt-1 text-xs"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Slack incoming webhook or any endpoint accepting JSON.</p>
              </div>
              <div className="space-y-2.5 pt-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Notify on</p>
                <Toggle label="Actively-exploited (KEV) CVEs" checked={settings?.notify_kev ?? false} onChange={(v) => set("notify_kev", v)} />
                <Toggle label="Critical risk alerts" checked={settings?.notify_critical ?? false} onChange={(v) => set("notify_critical", v)} />
                <Toggle label="SLA breaches" checked={settings?.notify_sla ?? false} onChange={(v) => set("notify_sla", v)} />
              </div>
              <div className="flex gap-2 pt-1">
                <Button onClick={saveSettings} disabled={saving} size="sm" className="flex-1">
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button onClick={sendTest} variant="outline" size="sm" className="flex-1 gap-1.5">
                  <Send className="w-3.5 h-3.5" /> Test
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Feed */}
          <Card className="lg:col-span-2" style={PANEL}>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notification Feed
                {unread > 0 && <span className="text-[10px] text-primary">{unread} unread</span>}
              </CardTitle>
              {items.length > 0 && (
                <div className="flex items-center gap-1">
                  <button onClick={markAll} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-white/5">
                    <Check className="w-3 h-3" /> Read all
                  </button>
                  <button onClick={clearAll} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10">
                    <Trash2 className="w-3 h-3" /> Clear
                  </button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="py-16 text-center">
                  <Bell className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-20" />
                  <p className="text-sm text-muted-foreground">No notifications. Click <strong>Scan Now</strong> to check current posture.</p>
                </div>
              ) : (
                items.map((n, i) => (
                  <div key={n.id} className="flex items-start gap-3 px-5 py-3"
                    style={{ borderBottom: i < items.length - 1 ? "1px solid oklch(1 0 0 / 5%)" : "none", background: n.read ? undefined : "oklch(0.62 0.20 32 / 4%)" }}>
                    <span className="mt-0.5 flex-shrink-0">{TYPE_ICON[n.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{timeAgo(n.created_at)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center justify-between w-full group">
      <span className="text-sm text-left">{label}</span>
      <span
        className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
        style={{ background: checked ? "oklch(0.62 0.20 32)" : "oklch(0.25 0.02 328)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ left: 2, transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}
