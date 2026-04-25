"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Server, Bug, AlertTriangle, TrendingUp, Shield, RefreshCw,
  ArrowUpRight, Activity, Zap, FlaskConical, PieChartIcon,
} from "lucide-react";
import type { Asset, Vulnerability, Alert } from "@/lib/types";
import { estimateAle } from "@/lib/rosi";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LabelList,
} from "recharts";
import { toast } from "sonner";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

const TYPE_COLORS = ["#E95420", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const TOOLTIP_STYLE = {
  background: "oklch(0.17 0.04 328)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: 8,
  fontSize: 12,
};

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const [a, v, al] = await Promise.all([
      fetch("/api/assets").then((r) => r.json()),
      fetch("/api/vulnerabilities").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
    ]);
    setAssets(Array.isArray(a) ? a : []);
    setVulns(Array.isArray(v) ? v : []);
    setAlerts(Array.isArray(al) ? al : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRisk = alerts.reduce((s, a) => s + (a.risk_score || 0), 0);
  const ale = estimateAle(totalRisk);
  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const exploitedVulns = vulns.filter((v) => v.known_exploited).length;

  const sevData = SEV_ORDER.map((s) => ({
    name: s,
    value: alerts.filter((a) => a.severity === s).length,
  })).filter((d) => d.value > 0);

  const topAlerts = [...alerts].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);
  const trendData = topAlerts.map((a) => ({
    name: a.cve?.replace("CVE-", "") ?? "—",
    score: parseFloat(a.risk_score.toFixed(2)),
  }));

  // Risk score aggregated by asset
  const riskByAsset = assets
    .map((asset) => {
      const score = alerts
        .filter((al) => {
          const v = vulns.find((v) => v.id === al.vulnerability_id);
          return v?.asset_id === asset.id;
        })
        .reduce((s, al) => s + al.risk_score, 0);
      return { name: asset.name.length > 14 ? asset.name.slice(0, 14) + "…" : asset.name, score: parseFloat(score.toFixed(2)) };
    })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // Asset type breakdown
  const typeMap: Record<string, number> = {};
  for (const a of assets) typeMap[a.asset_type] = (typeMap[a.asset_type] || 0) + 1;
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  async function syncAll() {
    setSyncing(true);
    const t = toast.loading("Syncing KEV + EPSS threat intel...");
    try {
      const [kev, epss] = await Promise.all([
        fetch("/api/sync/kev", { method: "POST" }).then((r) => r.json()),
        fetch("/api/sync/epss", { method: "POST" }).then((r) => r.json()),
      ]);
      toast.success(`Sync complete — KEV: ${kev.updated ?? 0} · EPSS: ${epss.updated ?? 0} updated`, { id: t });
      await load();
    } catch {
      toast.error("Sync failed", { id: t });
    } finally {
      setSyncing(false);
    }
  }

  async function seedDemo() {
    setSeeding(true);
    const t = toast.loading("Loading demo data...");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Demo loaded — ${data.assets} assets · ${data.vulns} CVEs · ${data.controls} controls`, { id: t });
      await load();
    } catch (err) {
      toast.error(`Failed: ${err}`, { id: t });
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Security Dashboard</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Real-time cyber risk overview ·{" "}
            {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={seedDemo} disabled={seeding} size="sm" variant="outline" className="gap-2 h-9">
            <FlaskConical className={`w-3.5 h-3.5 ${seeding ? "animate-pulse" : ""}`} />
            {seeding ? "Loading..." : "Load Demo Data"}
          </Button>
          <Button onClick={syncAll} disabled={syncing} size="sm" className="gap-2 h-9">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Threat Intel"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard loading={loading} icon={<Server className="w-4 h-4" />} label="Total Assets"
          value={assets.length} sub={`${assets.filter((a) => a.internet_exposed).length} internet exposed`}
          iconBg="bg-blue-500/10" iconColor="text-blue-400" />
        <KpiCard loading={loading} icon={<Bug className="w-4 h-4" />} label="Vulnerabilities"
          value={vulns.length} sub={`${exploitedVulns} actively exploited`}
          iconBg="bg-orange-500/10" iconColor="text-orange-400" trend={exploitedVulns > 0 ? "up" : undefined} />
        <KpiCard loading={loading} icon={<AlertTriangle className="w-4 h-4" />} label="Active Alerts"
          value={alerts.length} sub={`${criticalCount} critical severity`}
          iconBg="bg-red-500/10" iconColor="text-red-400" trend={criticalCount > 0 ? "up" : undefined} />
        <KpiCard loading={loading} icon={<TrendingUp className="w-4 h-4" />} label="Estimated ALE"
          value={`€${(ale / 1000).toFixed(0)}k`} sub="Annual Loss Expectancy"
          iconBg="bg-purple-500/10" iconColor="text-purple-400" />
      </div>

      {/* Severity breakdown bars */}
      {!loading && alerts.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {SEV_ORDER.map((s) => {
            const count = alerts.filter((a) => a.severity === s).length;
            const pct = alerts.length > 0 ? Math.round((count / alerts.length) * 100) : 0;
            return (
              <div key={s} className="relative rounded-xl p-4 overflow-hidden"
                style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
                <div className="absolute inset-0 opacity-5" style={{ background: SEV_COLORS[s] }} />
                <div className="flex items-center justify-between mb-2">
                  <SevBadge severity={s} />
                  <span className="text-xs text-muted-foreground">{pct}%</span>
                </div>
                <p className="text-2xl font-bold">{count}</p>
                <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "oklch(0.20 0.03 328)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SEV_COLORS[s] }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Charts row 1 — CVE trend + Severity donut */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3" style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Top Risk Scores by CVE
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[200px] w-full" /> : trendData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E95420" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#E95420" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "oklch(0.6 0 0)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "oklch(0.6 0 0)" }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="score" stroke="#E95420" strokeWidth={2} fill="url(#riskGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2" style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Severity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[200px] w-full" /> : sevData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sevData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3}>
                    {sevData.map((entry) => (
                      <Cell key={entry.name} fill={SEV_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 — Risk by Asset + Asset Type */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3" style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Risk Score by Asset
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[220px] w-full" /> : riskByAsset.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={riskByAsset} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9, fill: "oklch(0.6 0 0)" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.75 0 0)" }} width={90} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [Number(v).toFixed(2), "Risk Score"]} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {riskByAsset.map((entry, i) => (
                      <Cell key={i} fill={i === 0 ? "#ef4444" : i === 1 ? "#f97316" : "#E95420"} fillOpacity={1 - i * 0.08} />
                    ))}
                    <LabelList dataKey="score" position="right" style={{ fontSize: 10, fill: "oklch(0.7 0 0)" }} formatter={(v: number) => v.toFixed(1)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2" style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" /> Asset Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[220px] w-full" /> : typeData.length === 0 ? (
              <EmptyChart />
            ) : (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                      {typeData.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                  {typeData.map((t, i) => (
                    <span key={t.name} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} />
                      {t.name} <span className="font-semibold text-foreground">{t.value}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts feed */}
      <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Recent Alerts
          </CardTitle>
          {alerts.length > 0 && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">{alerts.length} total</Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 space-y-3 pb-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-14 text-center">
              <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">No alerts — load demo data or add vulnerabilities.</p>
            </div>
          ) : (
            alerts.slice(0, 10).map((a, i) => (
              <div key={a.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: i < Math.min(alerts.length, 10) - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <SevBadge severity={a.severity} />
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{a.cve}</p>
                  </div>
                </div>
                <div className="ml-4 flex-shrink-0 text-right">
                  <p className="text-sm font-bold font-mono"
                    style={{ color: a.risk_score >= 12 ? "#ef4444" : a.risk_score >= 9 ? "#f97316" : "inherit" }}>
                    {a.risk_score.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">risk score</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, sub, iconBg, iconColor, trend, loading }: {
  icon: React.ReactNode; label: string; value: string | number; sub: string;
  iconBg: string; iconColor: string; trend?: "up"; loading?: boolean;
}) {
  return (
    <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${iconBg}`}>
            <span className={iconColor}>{icon}</span>
          </div>
          {trend && <ArrowUpRight className="w-4 h-4 text-red-400" />}
        </div>
        {loading ? (
          <><Skeleton className="h-7 w-16 mb-1" /><Skeleton className="h-3 w-28" /></>
        ) : (
          <><p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p></>
        )}
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2 font-medium">{label}</p>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="h-[200px] flex items-center justify-center">
      <p className="text-sm text-muted-foreground">No data yet</p>
    </div>
  );
}

function SevBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
    HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    LOW: "bg-green-500/15 text-green-400 border-green-500/30",
  };
  return <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${map[severity] ?? ""}`}>{severity}</Badge>;
}
