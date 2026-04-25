"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Server, Bug, AlertTriangle, TrendingUp, Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Asset, Vulnerability, Alert } from "@/lib/types";
import { estimateAle } from "@/lib/rosi";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#22c55e",
};

export default function DashboardPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function load() {
    const [a, v, al] = await Promise.all([
      fetch("/api/assets").then((r) => r.json()),
      fetch("/api/vulnerabilities").then((r) => r.json()),
      fetch("/api/alerts").then((r) => r.json()),
    ]);
    setAssets(Array.isArray(a) ? a : []);
    setVulns(Array.isArray(v) ? v : []);
    setAlerts(Array.isArray(al) ? al : []);
  }

  useEffect(() => { load(); }, []);

  const totalRisk = alerts.reduce((s, a) => s + (a.risk_score || 0), 0);
  const ale = estimateAle(totalRisk);

  const sevCounts = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => ({
    name: s,
    value: alerts.filter((a) => a.severity === s).length,
  })).filter((d) => d.value > 0);

  const topAlerts = [...alerts].sort((a, b) => b.risk_score - a.risk_score).slice(0, 8);

  async function syncAll() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const [kev, epss] = await Promise.all([
        fetch("/api/sync/kev", { method: "POST" }).then((r) => r.json()),
        fetch("/api/sync/epss", { method: "POST" }).then((r) => r.json()),
      ]);
      setSyncMsg(`KEV: ${kev.updated ?? 0} updated · EPSS: ${epss.updated ?? 0} updated`);
      await load();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Cyber risk overview across all assets</p>
        </div>
        <Button onClick={syncAll} disabled={syncing} size="sm" variant="outline" className="gap-2">
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync KEV + EPSS"}
        </Button>
      </div>
      {syncMsg && <p className="text-xs text-primary">{syncMsg}</p>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard icon={<Server className="w-4 h-4" />} label="Assets" value={assets.length} />
        <KpiCard icon={<Bug className="w-4 h-4" />} label="Vulnerabilities" value={vulns.length} />
        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label="Active Alerts" value={alerts.length} color="text-orange-400" />
        <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Est. ALE" value={`€${ale.toLocaleString()}`} color="text-red-400" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Severity pie */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Alerts by Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {sevCounts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No alerts yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={sevCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {sevCounts.map((entry) => (
                      <Cell key={entry.name} fill={SEV_COLORS[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top risks bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top 8 Risk Scores</CardTitle>
          </CardHeader>
          <CardContent>
            {topAlerts.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">No alerts yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topAlerts} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="cve" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  />
                  <Bar dataKey="risk_score" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4 text-center">No alerts — add vulnerabilities to generate alerts.</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <SevBadge severity={a.severity} />
                    <span className="text-sm truncate">{a.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono ml-4 flex-shrink-0">
                    {a.risk_score.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <p className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SevBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
    HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    LOW: "bg-green-500/15 text-green-400 border-green-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${map[severity] ?? ""}`}>
      {severity}
    </Badge>
  );
}
