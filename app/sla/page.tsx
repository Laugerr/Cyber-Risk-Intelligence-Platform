"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Gauge, AlertOctagon, CalendarClock, Timer, Save, ShieldAlert } from "lucide-react";
import type { RemediationItem, SlaPolicy, SlaState, Severity } from "@/lib/types";
import { toast } from "sonner";

const PANEL = { background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" } as const;

const SEV_CLS: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/15 text-green-400 border-green-500/30",
};

const STATE_META: Record<SlaState, { label: string; cls: string; color: string }> = {
  breached: { label: "Breached", cls: "bg-red-500/15 text-red-400 border-red-500/30", color: "#ef4444" },
  due_soon: { label: "Due soon", cls: "bg-orange-500/15 text-orange-400 border-orange-500/30", color: "#f97316" },
  on_track: { label: "On track", cls: "bg-green-500/15 text-green-400 border-green-500/30", color: "#22c55e" },
  met: { label: "Met", cls: "bg-green-500/15 text-green-400 border-green-500/30", color: "#16a34a" },
  missed: { label: "Missed", cls: "bg-red-500/15 text-red-400 border-red-500/30", color: "#b91c1c" },
};

type Summary = {
  total: number; compliance_pct: number; breached: number; missed: number;
  due_soon: number; on_track: number; met: number; avg_overdue_days: number;
};

const FILTERS: { key: "all" | SlaState; label: string }[] = [
  { key: "all", label: "All" },
  { key: "breached", label: "Breached" },
  { key: "due_soon", label: "Due Soon" },
  { key: "on_track", label: "On Track" },
  { key: "met", label: "Resolved" },
];

const STATE_ORDER: Record<SlaState, number> = { breached: 0, due_soon: 1, on_track: 2, missed: 3, met: 4 };

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function SlaPage() {
  const [items, setItems] = useState<RemediationItem[]>([]);
  const [policy, setPolicy] = useState<SlaPolicy[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | SlaState>("all");

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/sla").then((r) => r.json());
      setItems(Array.isArray(data.items) ? data.items : []);
      setPolicy(Array.isArray(data.policy) ? data.policy : []);
      setSummary(data.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function editPolicy(severity: Severity, days: number) {
    setPolicy((prev) => prev.map((p) => (p.severity === severity ? { ...p, days } : p)));
  }

  async function savePolicy() {
    setSaving(true);
    const t = toast.loading("Saving SLA policy…");
    try {
      await Promise.all(
        policy.map((p) =>
          fetch("/api/sla", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
          })
        )
      );
      await load();
      toast.success("SLA policy saved — deadlines recalculated", { id: t });
    } catch {
      toast.error("Failed to save policy", { id: t });
    } finally {
      setSaving(false);
    }
  }

  const visible = items
    .filter((i) => filter === "all" || i.sla_state === filter)
    .sort((a, b) => STATE_ORDER[a.sla_state] - STATE_ORDER[b.sla_state] || a.days_remaining - b.days_remaining);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">SLA &amp; Remediation</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Remediation deadlines by severity, breach tracking, and SLA compliance
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Gauge className="w-4 h-4" />} iconBg="bg-green-500/10" iconColor="text-green-400"
              value={`${summary?.compliance_pct ?? 0}%`} label="SLA Compliance" sub="within deadline"
              valueColor={(summary?.compliance_pct ?? 0) >= 80 ? "#22c55e" : (summary?.compliance_pct ?? 0) >= 50 ? "#eab308" : "#ef4444"} />
            <Kpi icon={<AlertOctagon className="w-4 h-4" />} iconBg="bg-red-500/10" iconColor="text-red-400"
              value={summary?.breached ?? 0} label="Active Breaches" sub="past due, unresolved"
              valueColor={(summary?.breached ?? 0) > 0 ? "#ef4444" : undefined} />
            <Kpi icon={<CalendarClock className="w-4 h-4" />} iconBg="bg-orange-500/10" iconColor="text-orange-400"
              value={summary?.due_soon ?? 0} label="Due This Week" sub={`≤ 7 days remaining`} />
            <Kpi icon={<Timer className="w-4 h-4" />} iconBg="bg-purple-500/10" iconColor="text-purple-400"
              value={summary?.avg_overdue_days ? `${summary.avg_overdue_days}d` : "—"} label="Avg Overdue" sub="across breaches" />
          </div>

          {/* Policy editor + status bar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" /> Remediation SLA Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {policy.map((p) => (
                  <div key={p.severity} className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className={`text-[10px] font-bold ${SEV_CLS[p.severity]}`}>{p.severity}</Badge>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={1} value={p.days}
                        onChange={(e) => editPolicy(p.severity, Math.max(1, Number(e.target.value) || 1))}
                        className="w-20 h-8 text-sm text-right"
                      />
                      <span className="text-xs text-muted-foreground w-8">days</span>
                    </div>
                  </div>
                ))}
                <Button onClick={savePolicy} disabled={saving} size="sm" className="w-full gap-2 mt-1">
                  <Save className={`w-3.5 h-3.5 ${saving ? "animate-pulse" : ""}`} />
                  {saving ? "Saving…" : "Save Policy"}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2" style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-primary" /> SLA Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col justify-center h-[calc(100%-3rem)]">
                <StatusBar summary={summary} total={items.length} />
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4">
                  {(["breached", "due_soon", "on_track", "met", "missed"] as SlaState[]).map((s) => {
                    const n = items.filter((i) => i.sla_state === s).length;
                    return (
                      <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: STATE_META[s].color }} />
                        {STATE_META[s].label} <span className="font-semibold text-foreground">{n}</span>
                      </span>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const n = f.key === "all" ? items.length : items.filter((i) => i.sla_state === f.key).length;
              const isActive = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={
                    isActive
                      ? { background: "oklch(0.62 0.20 32 / 12%)", border: "1px solid oklch(0.62 0.20 32 / 30%)", color: "oklch(0.7 0.15 32)" }
                      : { background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.65 0 0)" }
                  }
                >
                  {f.label} <span className="opacity-60">{n}</span>
                </button>
              );
            })}
          </div>

          {/* Queue */}
          <Card style={PANEL}>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  No vulnerabilities in this view.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground" style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
                        <th className="px-5 py-3 font-medium">CVE / Asset</th>
                        <th className="px-3 py-3 font-medium">Severity</th>
                        <th className="px-3 py-3 font-medium hidden sm:table-cell">Detected</th>
                        <th className="px-3 py-3 font-medium">Due</th>
                        <th className="px-3 py-3 font-medium">Remaining</th>
                        <th className="px-5 py-3 font-medium text-right">SLA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((i, idx) => {
                        const overdue = i.days_remaining < 0;
                        const resolved = i.status === "resolved";
                        return (
                          <tr key={i.id} className="hover:bg-white/[0.02]" style={{ borderBottom: idx < visible.length - 1 ? "1px solid oklch(1 0 0 / 5%)" : "none" }}>
                            <td className="px-5 py-3">
                              <p className="font-mono text-xs">{i.cve}</p>
                              <p className="text-[11px] text-muted-foreground truncate max-w-[220px]">{i.asset_name}</p>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className={`text-[10px] font-bold ${SEV_CLS[i.severity]}`}>{i.severity}</Badge>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground text-xs hidden sm:table-cell">{fmtDate(i.detected_at)}</td>
                            <td className="px-3 py-3 text-xs">{fmtDate(i.due_date)}</td>
                            <td className="px-3 py-3 text-xs font-medium" style={{ color: resolved ? "inherit" : overdue ? "#ef4444" : i.days_remaining <= 7 ? "#f97316" : "inherit" }}>
                              {resolved ? "—" : overdue ? `${Math.abs(i.days_remaining)}d overdue` : `${i.days_remaining}d`}
                            </td>
                            <td className="px-5 py-3 text-right">
                              <Badge variant="outline" className={`text-[10px] font-bold ${STATE_META[i.sla_state].cls}`}>{STATE_META[i.sla_state].label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({ icon, iconBg, iconColor, value, label, sub, valueColor }: {
  icon: React.ReactNode; iconBg: string; iconColor: string;
  value: string | number; label: string; sub: string; valueColor?: string;
}) {
  return (
    <Card style={PANEL}>
      <CardContent className="pt-5">
        <div className={`flex items-center justify-center w-9 h-9 rounded-lg mb-3 ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <p className="text-2xl font-bold tracking-tight" style={valueColor ? { color: valueColor } : undefined}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatusBar({ summary, total }: { summary: Summary | null; total: number }) {
  if (!summary || total === 0) return <p className="text-sm text-muted-foreground text-center py-6">No vulnerabilities to track.</p>;
  const segs: { state: SlaState; n: number }[] = [
    { state: "breached", n: summary.breached },
    { state: "due_soon", n: summary.due_soon },
    { state: "on_track", n: summary.on_track },
    { state: "met", n: summary.met },
    { state: "missed", n: summary.missed },
  ];
  return (
    <div className="flex w-full h-6 rounded-lg overflow-hidden" style={{ border: "1px solid oklch(1 0 0 / 8%)" }}>
      {segs.map((s) =>
        s.n > 0 ? (
          <div
            key={s.state}
            title={`${STATE_META[s.state].label}: ${s.n}`}
            className="flex items-center justify-center text-[10px] font-bold text-black/70"
            style={{ width: `${(s.n / total) * 100}%`, background: STATE_META[s.state].color }}
          >
            {(s.n / total) > 0.08 ? s.n : ""}
          </div>
        ) : null
      )}
    </div>
  );
}
