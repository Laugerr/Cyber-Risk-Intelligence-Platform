"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Server, Monitor, Cloud, Network, Globe, Database, Box,
  Shield, Bug, AlertTriangle, TrendingUp, Flame, CheckCircle2, Clock, CircleDot,
} from "lucide-react";
import type { Asset, Vulnerability, Alert, VulnStatus } from "@/lib/types";
import { calculateRisk } from "@/lib/scoring";
import { estimateAle } from "@/lib/rosi";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { toast } from "sonner";

const TYPE_ICON: Record<string, React.ReactNode> = {
  Server: <Server className="w-4 h-4" />,
  Workstation: <Monitor className="w-4 h-4" />,
  Cloud: <Cloud className="w-4 h-4" />,
  Network: <Network className="w-4 h-4" />,
  WebApp: <Globe className="w-4 h-4" />,
  Database: <Database className="w-4 h-4" />,
  Other: <Box className="w-4 h-4" />,
};

const SEV_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e",
};

const STATUS_CONFIG: Record<VulnStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: { label: "Open", color: "bg-red-500/15 text-red-400 border-red-500/30", icon: <CircleDot className="w-3 h-3" /> },
  in_progress: { label: "In Progress", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30", icon: <Clock className="w-3 h-3" /> },
  resolved: { label: "Resolved", color: "bg-green-500/15 text-green-400 border-green-500/30", icon: <CheckCircle2 className="w-3 h-3" /> },
};

const STATUS_CYCLE: Record<VulnStatus, VulnStatus> = {
  open: "in_progress",
  in_progress: "resolved",
  resolved: "open",
};

const TOOLTIP_STYLE = {
  background: "oklch(0.17 0.04 328)",
  border: "1px solid oklch(1 0 0 / 10%)",
  borderRadius: 8,
  fontSize: 12,
};

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await fetch(`/api/assets/${id}`).then((r) => r.json());
    if (data.error) { toast.error("Asset not found"); router.push("/assets"); return; }
    setAsset(data.asset);
    setVulns(data.vulns);
    setAlerts(data.alerts);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function cycleStatus(vuln: Vulnerability) {
    const next = STATUS_CYCLE[vuln.status ?? "open"];
    await fetch(`/api/vulnerabilities/${vuln.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    toast.success(`Status → ${STATUS_CONFIG[next].label}`);
    setVulns((prev) => prev.map((v) => v.id === vuln.id ? { ...v, status: next } : v));
  }

  if (loading || !asset) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading asset…
      </div>
    );
  }

  const totalRisk = alerts.reduce((s, a) => s + a.risk_score, 0);
  const ale = estimateAle(totalRisk);
  const openVulns = vulns.filter((v) => !v.status || v.status === "open").length;
  const resolvedVulns = vulns.filter((v) => v.status === "resolved").length;
  const kevCount = vulns.filter((v) => v.known_exploited).length;

  const sevData = ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => ({
    name: s,
    value: alerts.filter((a) => a.severity === s).length,
  })).filter((d) => d.value > 0);

  const cvssData = vulns.map((v) => ({
    cve: v.cve.replace("CVE-", ""),
    cvss: v.cvss,
    fill: v.cvss >= 9 ? "#ef4444" : v.cvss >= 7 ? "#f97316" : v.cvss >= 4 ? "#eab308" : "#22c55e",
  })).sort((a, b) => b.cvss - a.cvss).slice(0, 8);

  const critColors: Record<number, string> = { 1: "#22c55e", 2: "#84cc16", 3: "#eab308", 4: "#f97316", 5: "#ef4444" };
  const critLabels: Record<number, string> = { 1: "Low", 2: "Low-Med", 3: "Medium", 4: "High", 5: "Critical" };

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 mt-0.5 shrink-0" onClick={() => router.push("/assets")}>
          <ArrowLeft className="w-4 h-4" /> Assets
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl text-primary shrink-0"
              style={{ background: "oklch(0.62 0.20 32 / 12%)", border: "1px solid oklch(0.62 0.20 32 / 25%)" }}>
              {TYPE_ICON[asset.asset_type] ?? TYPE_ICON.Other}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{asset.name}</h1>
              <p className="text-sm text-muted-foreground">{asset.asset_type} · {asset.owner}</p>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Badge variant="outline" className="text-[10px]"
                style={{ color: critColors[asset.criticality], borderColor: `${critColors[asset.criticality]}40` }}>
                Criticality {asset.criticality} — {critLabels[asset.criticality]}
              </Badge>
              {asset.internet_exposed ? (
                <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">Internet Exposed</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">Internal</Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniKpi label="Total CVEs" value={vulns.length} icon={<Bug className="w-4 h-4" />} color="text-orange-400" bg="bg-orange-500/10" />
        <MiniKpi label="Open" value={openVulns} icon={<AlertTriangle className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" />
        <MiniKpi label="KEV (Active Exploit)" value={kevCount} icon={<Flame className="w-4 h-4" />} color="text-red-400" bg="bg-red-500/10" />
        <MiniKpi label="Est. ALE" value={`€${(ale / 1000).toFixed(0)}k`} icon={<TrendingUp className="w-4 h-4" />} color="text-primary" bg="bg-primary/10" />
      </div>

      {/* Charts */}
      {(sevData.length > 0 || cvssData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Alert severity donut */}
          <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" /> Alert Severity Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sevData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No alerts</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={160}>
                    <PieChart>
                      <Pie data={sevData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                        {sevData.map((e) => <Cell key={e.name} fill={SEV_COLORS[e.name]} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {sevData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: SEV_COLORS[d.name] }} />
                        <span className="text-xs text-muted-foreground">{d.name}</span>
                        <span className="text-xs font-semibold ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* CVSS bar */}
          <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Bug className="w-4 h-4 text-primary" /> CVSS by CVE
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cvssData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No vulnerabilities</div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={cvssData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
                    <XAxis dataKey="cve" tick={{ fontSize: 8, fill: "oklch(0.6 0 0)" }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: "oklch(0.6 0 0)" }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, "CVSS"]} />
                    <Bar dataKey="cvss" radius={[3, 3, 0, 0]}>
                      {cvssData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Remediation progress bar */}
      {vulns.length > 0 && (
        <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Remediation Progress</span>
              <span className="text-xs text-muted-foreground">{resolvedVulns} / {vulns.length} resolved</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "oklch(1 0 0 / 8%)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(resolvedVulns / vulns.length) * 100}%`, background: "oklch(0.62 0.20 32)" }}
              />
            </div>
            <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CircleDot className="w-3 h-3 text-red-400" /> {vulns.filter((v) => !v.status || v.status === "open").length} Open</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-yellow-400" /> {vulns.filter((v) => v.status === "in_progress").length} In Progress</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-400" /> {resolvedVulns} Resolved</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vulnerability table */}
      <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bug className="w-4 h-4 text-primary" /> Vulnerabilities
            <span className="text-xs text-muted-foreground font-normal ml-1">— click status badge to cycle</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {vulns.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No vulnerabilities for this asset.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }} className="text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">CVE</th>
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-5 py-3">CVSS</th>
                  <th className="text-left px-5 py-3">EPSS</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {vulns.map((v) => {
                  const status = v.status ?? "open";
                  const cfg = STATUS_CONFIG[status];
                  const risk = calculateRisk(v.cvss, asset.criticality, asset.internet_exposed, v.known_exploited, false, v.epss_score);
                  return (
                    <tr key={v.id} style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }}
                      className={`last:border-0 hover:bg-white/[0.03] transition-colors ${status === "resolved" ? "opacity-50" : ""}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-primary text-xs">{v.cve}</span>
                          {v.known_exploited && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">KEV</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground max-w-xs truncate">{v.title}</td>
                      <td className="px-5 py-3.5">
                        <CvssBar value={v.cvss} />
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{v.epss_score != null ? v.epss_score.toFixed(3) : "—"}</td>
                      <td className="px-5 py-3.5">
                        <SevBadge severity={risk.severity} />
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => cycleStatus(v)}
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border cursor-pointer hover:opacity-80 transition-opacity ${cfg.color}`}
                        >
                          {cfg.icon}{cfg.label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-primary" /> Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {alerts.map((a, i) => (
              <div key={a.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: i < alerts.length - 1 ? "1px solid oklch(1 0 0 / 5%)" : "none" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <SevBadge severity={a.severity} />
                  <div className="min-w-0">
                    <p className="text-sm truncate font-medium">{a.title}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{a.cve}</p>
                  </div>
                </div>
                <span className="text-sm font-bold font-mono ml-4 shrink-0"
                  style={{ color: a.risk_score >= 12 ? "#ef4444" : a.risk_score >= 9 ? "#f97316" : "inherit" }}>
                  {a.risk_score.toFixed(2)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MiniKpi({ label, value, icon, color, bg }: { label: string; value: string | number; icon: React.ReactNode; color: string; bg: string }) {
  return (
    <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${bg} ${color}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function CvssBar({ value }: { value: number }) {
  const color = value >= 9 ? "#ef4444" : value >= 7 ? "#f97316" : value >= 4 ? "#eab308" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${(value / 10) * 100}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold" style={{ color }}>{value.toFixed(1)}</span>
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
