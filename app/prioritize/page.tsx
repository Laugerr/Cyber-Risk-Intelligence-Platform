"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, Zap, ListChecks, Crosshair, Info } from "lucide-react";
import { DECISION_META, type Decision, type SsvcAssessment } from "@/lib/ssvc";
import type { Severity } from "@/lib/types";

const PANEL = { background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" } as const;

const SEV_CLS: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-400 border-red-500/30",
  HIGH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  LOW: "bg-green-500/15 text-green-400 border-green-500/30",
};

interface PItem {
  id: number;
  cve: string;
  title: string;
  asset_name: string;
  severity: Severity | null;
  cvss: number;
  epss_score: number | null;
  known_exploited: boolean;
  risk_score: number;
  ssvc: SsvcAssessment;
}

type Summary = { total: number; act: number; attend: number; track_star: number; track: number; needs_action: number };

const DECISIONS: Decision[] = ["Act", "Attend", "Track*", "Track"];

// "Bad" decision-point values get hot colors, benign ones stay muted.
function chipColor(value: string): string {
  if (["active", "open", "yes", "high"].includes(value)) return "#ef4444";
  if (["poc", "controlled", "medium"].includes(value)) return "#f97316";
  if (["small", "low"].includes(value)) return "#6b7280";
  return "#6b7280";
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
      style={{ borderColor: `${chipColor(value)}55`, background: `${chipColor(value)}1a`, color: chipColor(value) }}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-semibold capitalize">{value}</span>
    </span>
  );
}

export default function PrioritizePage() {
  const [items, setItems] = useState<PItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Decision>("all");

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/prioritize").then((r) => r.json());
      setItems(Array.isArray(data.items) ? data.items : []);
      setSummary(data.summary ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = items.filter((i) => filter === "all" || i.ssvc.decision === filter);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Smart Prioritization</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-3.5">
          CISA SSVC decision model — what to fix first, beyond raw CVSS
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Crosshair className="w-4 h-4" />} iconBg="bg-red-500/10" iconColor="text-red-400"
              value={summary?.act ?? 0} label="Act" sub="remediate now" valueColor={(summary?.act ?? 0) > 0 ? "#ef4444" : undefined} />
            <Kpi icon={<Zap className="w-4 h-4" />} iconBg="bg-orange-500/10" iconColor="text-orange-400"
              value={summary?.attend ?? 0} label="Attend" sub="remediate soon" />
            <Kpi icon={<Target className="w-4 h-4" />} iconBg="bg-purple-500/10" iconColor="text-purple-400"
              value={summary?.needs_action ?? 0} label="Needs Action" sub="Act + Attend" />
            <Kpi icon={<ListChecks className="w-4 h-4" />} iconBg="bg-blue-500/10" iconColor="text-blue-400"
              value={summary?.total ?? 0} label="In Queue" sub="unresolved vulns" />
          </div>

          {/* Decision distribution */}
          <Card style={PANEL}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" /> SSVC Decision Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex w-full h-6 rounded-lg overflow-hidden" style={{ border: "1px solid oklch(1 0 0 / 8%)" }}>
                {DECISIONS.map((d) => {
                  const n = items.filter((i) => i.ssvc.decision === d).length;
                  return n > 0 ? (
                    <div key={d} title={`${d}: ${n}`} className="flex items-center justify-center text-[10px] font-bold text-black/70"
                      style={{ width: `${(n / items.length) * 100}%`, background: DECISION_META[d].color }}>
                      {n / items.length > 0.08 ? n : ""}
                    </div>
                  ) : null;
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                {DECISIONS.map((d) => (
                  <span key={d} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: DECISION_META[d].color }} />
                    <span className="font-semibold text-foreground">{DECISION_META[d].label}</span>
                    <span className="opacity-70">— {DECISION_META[d].blurb}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-2">
            {(["all", ...DECISIONS] as const).map((key) => {
              const n = key === "all" ? items.length : items.filter((i) => i.ssvc.decision === key).length;
              const isActive = filter === key;
              return (
                <button key={key} onClick={() => setFilter(key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={isActive
                    ? { background: "oklch(0.62 0.20 32 / 12%)", border: "1px solid oklch(0.62 0.20 32 / 30%)", color: "oklch(0.7 0.15 32)" }
                    : { background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.65 0 0)" }}>
                  {key === "all" ? "All" : DECISION_META[key].label} <span className="opacity-60">{n}</span>
                </button>
              );
            })}
          </div>

          {/* Queue */}
          <Card style={PANEL}>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-primary" /> Fix These First
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">ranked by SSVC decision, then risk score</span>
            </CardHeader>
            <CardContent className="p-0">
              {visible.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  Nothing in this view — load demo data or sync threat intel to populate the queue.
                </div>
              ) : (
                visible.map((i, idx) => (
                  <div key={i.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: idx < visible.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none" }}>
                    <span className="text-sm font-bold text-muted-foreground w-6 flex-shrink-0 pt-0.5">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-mono text-xs">{i.cve}</span>
                        {i.severity && <Badge variant="outline" className={`text-[9px] font-bold ${SEV_CLS[i.severity]}`}>{i.severity}</Badge>}
                        {i.known_exploited && <Badge variant="outline" className="text-[9px] font-bold bg-red-500/15 text-red-400 border-red-500/30">KEV</Badge>}
                        <span className="text-[11px] text-muted-foreground truncate">{i.asset_name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Chip label="Exploit:" value={i.ssvc.exploitation} />
                        <Chip label="Exposure:" value={i.ssvc.exposure} />
                        <Chip label="Automatable:" value={i.ssvc.automatable} />
                        <Chip label="Impact:" value={i.ssvc.impact} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="outline" className={`text-[10px] font-bold ${DECISION_META[i.ssvc.decision].cls}`}>
                        {DECISION_META[i.ssvc.decision].label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        EPSS {i.epss_score != null ? `${(i.epss_score * 100).toFixed(0)}%` : "—"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Explainer */}
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground px-1">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-primary" />
            <p>
              <strong className="text-foreground">SSVC</strong> (Stakeholder-Specific Vulnerability Categorization) prioritizes by real-world
              context — active exploitation, system exposure, attack automatability, and mission impact — rather than CVSS severity alone.
              Decisions escalate <strong>Track → Track* → Attend → Act</strong>.
            </p>
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
