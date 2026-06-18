"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Activity, Bug, Clock, Zap, History, CalendarClock, Minus,
} from "lucide-react";
import type { RiskSnapshot } from "@/lib/types";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";

const PANEL = { background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" } as const;
const TOOLTIP_STYLE = {
  background: "oklch(0.205 0.005 286)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: 8,
  fontSize: 12,
};

function fmtDay(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export default function TrendsPage() {
  const [snaps, setSnaps] = useState<RiskSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/snapshot"); // captures today + returns history
      const data = await res.json();
      setSnaps(Array.isArray(data.snapshots) ? data.snapshots : []);
    } catch {
      setSnaps([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generateHistory() {
    setWorking(true);
    const t = toast.loading("Generating 30-day history…");
    try {
      const res = await fetch("/api/snapshot", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSnaps(Array.isArray(data.snapshots) ? data.snapshots : []);
      toast.success(`History ready — ${data.backfilled} daily snapshots`, { id: t });
    } catch (err) {
      toast.error(`Failed: ${err}`, { id: t });
    } finally {
      setWorking(false);
    }
  }

  const chartData = snaps.map((s) => ({
    date: fmtDay(s.captured_on),
    risk: s.total_risk,
    ale: Math.round(s.ale / 1000),
    open: s.open_count,
    resolved: s.resolved_count,
    inProgress: s.in_progress_count,
    exploited: s.exploited_count,
    critical: s.critical_count,
    high: s.high_count,
  }));

  const first = snaps[0];
  const last = snaps[snaps.length - 1];
  const riskDelta = first && last ? last.total_risk - first.total_risk : 0;
  const openDelta = first && last ? last.open_count - first.open_count : 0;
  const peakRisk = snaps.reduce((m, s) => Math.max(m, s.total_risk), 0);
  const mttr = [...snaps].reverse().find((s) => s.mttr_days != null)?.mttr_days ?? null;

  const enoughData = snaps.length >= 3;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Risk Trends</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Historical posture, vulnerability burndown, and mean time to remediate
          </p>
        </div>
        <Button onClick={generateHistory} disabled={working} size="sm" variant="outline" className="gap-2 h-9">
          <History className={`w-3.5 h-3.5 ${working ? "animate-pulse" : ""}`} />
          {working ? "Generating…" : enoughData ? "Regenerate History" : "Generate History"}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !enoughData ? (
        <EmptyState onGenerate={generateHistory} working={working} />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <TrendKpi
              icon={<Activity className="w-4 h-4" />} iconBg="bg-orange-500/10" iconColor="text-orange-400"
              label="Current Risk Score" value={last?.total_risk.toFixed(1) ?? "—"}
              delta={riskDelta} deltaGood="down" unit="" sub={`over ${snaps.length} days`} />
            <TrendKpi
              icon={<Bug className="w-4 h-4" />} iconBg="bg-red-500/10" iconColor="text-red-400"
              label="Open Vulnerabilities" value={last?.open_count ?? "—"}
              delta={openDelta} deltaGood="down" unit="" sub={`${last?.resolved_count ?? 0} resolved`} />
            <TrendKpi
              icon={<Clock className="w-4 h-4" />} iconBg="bg-blue-500/10" iconColor="text-blue-400"
              label="Mean Time To Remediate" value={mttr != null ? `${mttr}d` : "—"}
              sub="avg open → resolved" />
            <TrendKpi
              icon={<Zap className="w-4 h-4" />} iconBg="bg-purple-500/10" iconColor="text-purple-400"
              label="Peak Risk (period)" value={peakRisk.toFixed(1)}
              sub={`now ${last?.total_risk.toFixed(1) ?? "—"}`} />
          </div>

          {/* Risk score over time */}
          <Card style={PANEL}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Aggregate Risk Score Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="risk" name="Risk score" stroke="#10b981" strokeWidth={2} fill="url(#riskArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Burndown + Severity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-primary" /> Vulnerability Burndown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="open" name="Open" stroke="#ef4444" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" /> Critical & High Alerts Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} minTickGap={20} />
                    <YAxis tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="critical" name="Critical" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                    <Area type="monotone" dataKey="high" name="High" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.35} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* KEV exposure */}
          <Card style={PANEL}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Actively-Exploited (CISA KEV) Exposure Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="kevArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} minTickGap={20} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="exploited" name="KEV CVEs" stroke="#a855f7" strokeWidth={2} fill="url(#kevArea)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TrendKpi({
  icon, iconBg, iconColor, label, value, sub, delta, deltaGood, unit = "",
}: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string;
  value: string | number; sub: string; delta?: number; deltaGood?: "up" | "down"; unit?: string;
}) {
  const showDelta = delta != null && Math.abs(delta) > 0.05;
  // "Good" direction is green; e.g. risk going down is good.
  const isGood = deltaGood === "down" ? (delta ?? 0) < 0 : (delta ?? 0) > 0;
  return (
    <Card style={PANEL}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${iconBg}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          {showDelta ? (
            <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isGood ? "text-green-400" : "text-red-400"}`}>
              {(delta ?? 0) < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {Math.abs(delta ?? 0).toFixed(unit === "" ? 1 : 0)}{unit}
            </span>
          ) : delta != null ? (
            <span className="text-muted-foreground"><Minus className="w-3 h-3" /></span>
          ) : null}
        </div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onGenerate, working }: { onGenerate: () => void; working: boolean }) {
  return (
    <Card style={PANEL}>
      <CardContent className="py-16 text-center">
        <div
          className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4"
          style={{ background: "oklch(0.70 0.15 162 / 12%)", border: "1px solid oklch(0.70 0.15 162 / 25%)" }}
        >
          <CalendarClock className="w-7 h-7 text-primary" />
        </div>
        <h3 className="text-base font-semibold mb-1">No trend history yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
          Snapshots are captured daily, so trends build up over time. Generate a realistic
          30-day history that converges to your live numbers to see the charts now.
        </p>
        <Button onClick={onGenerate} disabled={working} className="gap-2">
          <History className={`w-4 h-4 ${working ? "animate-pulse" : ""}`} />
          {working ? "Generating…" : "Generate 30-Day History"}
        </Button>
      </CardContent>
    </Card>
  );
}
