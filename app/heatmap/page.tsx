"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid3x3, AlertOctagon, Layers, Crosshair } from "lucide-react";
import type { Asset, Vulnerability, Alert, Severity } from "@/lib/types";

const PANEL = { background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" } as const;

const SEV_CLS: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/15 text-green-400 border-green-500/30",
};

const IMPACT_LABELS = ["", "Minimal", "Minor", "Moderate", "Major", "Severe"];
const LIKELIHOOD_LABELS = ["", "Rare", "Unlikely", "Possible", "Likely", "Almost certain"];

interface Cell { likelihood: number; impact: number; }
interface PlottedItem extends Cell {
  id: number; cve: string; title: string; asset_name: string; severity: Severity | null; score: number;
}

// Risk zone colour from likelihood × impact (1–25), as on a standard 5×5 matrix.
function zoneColor(score: number): string {
  if (score >= 15) return "#ef4444";
  if (score >= 8) return "#f97316";
  if (score >= 4) return "#eab308";
  return "#22c55e";
}
function zoneLabel(score: number): string {
  if (score >= 15) return "Critical";
  if (score >= 8) return "High";
  if (score >= 4) return "Medium";
  return "Low";
}

function likelihoodOf(v: Vulnerability, asset: Asset | undefined): number {
  const epss = v.epss_score ?? 0;
  let l = v.known_exploited ? 5 : epss >= 0.4 ? 4 : epss >= 0.1 ? 3 : epss > 0 ? 2 : 1;
  if (asset?.internet_exposed && l < 5) l += 1;
  return Math.max(1, Math.min(5, l));
}

export default function HeatmapPage() {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Cell | null>(null);

  const load = useCallback(async () => {
    try {
      const [v, a, al] = await Promise.all([
        fetch("/api/vulnerabilities").then((r) => r.json()),
        fetch("/api/assets").then((r) => r.json()),
        fetch("/api/alerts").then((r) => r.json()),
      ]);
      setVulns(Array.isArray(v) ? v : []);
      setAssets(Array.isArray(a) ? a : []);
      setAlerts(Array.isArray(al) ? al : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = useMemo<PlottedItem[]>(() => {
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const sevByKey = new Map(alerts.map((a) => [`${a.asset_id}:${a.cve}`, a.severity]));
    return vulns
      .filter((v) => v.status !== "resolved")
      .map((v) => {
        const asset = assetById.get(v.asset_id);
        const impact = asset?.criticality ?? 3;
        const likelihood = likelihoodOf(v, asset);
        return {
          id: v.id!, cve: v.cve, title: v.title,
          asset_name: asset?.name ?? `asset #${v.asset_id}`,
          severity: sevByKey.get(`${v.asset_id}:${v.cve}`) ?? null,
          likelihood, impact, score: likelihood * impact,
        };
      });
  }, [vulns, assets, alerts]);

  // grid[impact][likelihood] = count
  const grid = useMemo(() => {
    const g: Record<string, PlottedItem[]> = {};
    for (const it of items) (g[`${it.impact}:${it.likelihood}`] ??= []).push(it);
    return g;
  }, [items]);

  const critCount = items.filter((i) => i.score >= 15).length;
  const highCount = items.filter((i) => i.score >= 8 && i.score < 15).length;

  const cellItems = selected ? grid[`${selected.impact}:${selected.likelihood}`] ?? [] : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Risk Heatmap</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-3.5">
          5×5 likelihood × impact matrix — likelihood from exploitation &amp; EPSS, impact from asset criticality
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-[420px] w-full" />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<AlertOctagon className="w-4 h-4" />} iconBg="bg-red-500/10" iconColor="text-red-400"
              value={critCount} label="Critical Zone" sub="score ≥ 15" valueColor={critCount > 0 ? "#ef4444" : undefined} />
            <Kpi icon={<Crosshair className="w-4 h-4" />} iconBg="bg-orange-500/10" iconColor="text-orange-400"
              value={highCount} label="High Zone" sub="score 8–14" />
            <Kpi icon={<Layers className="w-4 h-4" />} iconBg="bg-blue-500/10" iconColor="text-blue-400"
              value={items.length} label="Plotted Risks" sub="unresolved vulns" />
            <Kpi icon={<Grid3x3 className="w-4 h-4" />} iconBg="bg-purple-500/10" iconColor="text-purple-400"
              value={items.length ? Math.max(...items.map((i) => i.score)) : 0} label="Peak Cell Score" sub="likelihood × impact" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Matrix */}
            <Card className="lg:col-span-2" style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Grid3x3 className="w-4 h-4 text-primary" /> Likelihood × Impact Matrix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {/* Y axis label */}
                  <div className="flex items-center">
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground -rotate-90 whitespace-nowrap">Impact →</span>
                  </div>
                  <div className="flex-1">
                    {/* rows: impact 5 (top) → 1 (bottom) */}
                    {[5, 4, 3, 2, 1].map((impact) => (
                      <div key={impact} className="flex gap-1.5 mb-1.5">
                        <div className="w-16 flex flex-col items-end justify-center pr-1">
                          <span className="text-[11px] font-semibold">{impact}</span>
                          <span className="text-[8px] text-muted-foreground leading-tight">{IMPACT_LABELS[impact]}</span>
                        </div>
                        {[1, 2, 3, 4, 5].map((likelihood) => {
                          const score = likelihood * impact;
                          const list = grid[`${impact}:${likelihood}`] ?? [];
                          const isSel = selected?.impact === impact && selected?.likelihood === likelihood;
                          const color = zoneColor(score);
                          return (
                            <button
                              key={likelihood}
                              onClick={() => setSelected(isSel ? null : { impact, likelihood })}
                              className="relative flex-1 aspect-square rounded-md flex items-center justify-center transition-all"
                              style={{
                                background: `${color}${list.length ? "33" : "12"}`,
                                border: isSel ? `2px solid ${color}` : `1px solid ${color}40`,
                              }}
                              title={`${zoneLabel(score)} risk (${score}) — ${list.length} item${list.length === 1 ? "" : "s"}`}
                            >
                              <span className="text-lg font-bold" style={{ color: list.length ? color : "oklch(0.5 0 0)" }}>
                                {list.length || ""}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                    {/* X axis ticks */}
                    <div className="flex gap-1.5 mt-1">
                      <div className="w-16" />
                      {[1, 2, 3, 4, 5].map((l) => (
                        <div key={l} className="flex-1 flex flex-col items-center">
                          <span className="text-[11px] font-semibold">{l}</span>
                          <span className="text-[8px] text-muted-foreground leading-tight text-center">{LIKELIHOOD_LABELS[l]}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mt-2">Likelihood →</p>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4">
                  {[["Low", "#22c55e"], ["Medium", "#eab308"], ["High", "#f97316"], ["Critical", "#ef4444"]].map(([label, c]) => (
                    <span key={label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ background: c }} /> {label}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cell detail */}
            <Card style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {selected ? `Cell ${selected.likelihood}×${selected.impact} — ${zoneLabel(selected.likelihood * selected.impact)} (${selected.likelihood * selected.impact})` : "Cell Detail"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!selected ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                    Click a cell to see the vulnerabilities plotted there.
                  </div>
                ) : cellItems.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-muted-foreground">No risks in this cell.</div>
                ) : (
                  cellItems.map((it, i) => (
                    <div key={it.id} className="px-5 py-2.5" style={{ borderBottom: i < cellItems.length - 1 ? "1px solid oklch(1 0 0 / 5%)" : "none" }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-xs">{it.cve}</span>
                        {it.severity && <Badge variant="outline" className={`text-[9px] font-bold ${SEV_CLS[it.severity]}`}>{it.severity}</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{it.asset_name} · {it.title}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
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
