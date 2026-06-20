"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Crosshair, Timer, ShieldCheck, ScrollText, ArrowRight, Plus, Pencil, Trash2, Upload, Database, Link2, Check, RefreshCw } from "lucide-react";
import { FRAMEWORKS, coveragePct, type CompStatus } from "@/lib/frameworks";
import { DECISION_META, type Decision } from "@/lib/ssvc";
import type { ComplianceStatus, AuditLog } from "@/lib/types";

const PANEL = { background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" } as const;
const DECISIONS: Decision[] = ["Act", "Attend", "Track*", "Track"];

type SsvcSummary = { act: number; attend: number; track_star: number; track: number; total: number };
type SlaSummary = { compliance_pct: number; breached: number; due_soon: number };

const ACTION_ICON: Record<string, React.ReactNode> = {
  create: <Plus className="w-3 h-3" />, update: <Pencil className="w-3 h-3" />,
  delete: <Trash2 className="w-3 h-3" />, import: <Upload className="w-3 h-3" />,
  seed: <Database className="w-3 h-3" />, match: <Link2 className="w-3 h-3" />,
  acknowledge: <Check className="w-3 h-3" />, sync: <RefreshCw className="w-3 h-3" />,
};
const ACTION_COLOR: Record<string, string> = {
  create: "#22c55e", update: "#3b82f6", delete: "#ef4444", import: "#a855f7",
  seed: "#f97316", match: "#f97316", acknowledge: "#22c55e", sync: "#3b82f6",
};

function timeAgo(iso?: string) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function CommandCenter({ refreshKey = 0 }: { refreshKey?: number }) {
  const [ssvc, setSsvc] = useState<SsvcSummary | null>(null);
  const [sla, setSla] = useState<SlaSummary | null>(null);
  const [coverage, setCoverage] = useState<{ short: string; pct: number }[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s, c, a] = await Promise.all([
          fetch("/api/prioritize").then((r) => r.json()),
          fetch("/api/sla").then((r) => r.json()),
          fetch("/api/compliance").then((r) => r.json()),
          fetch("/api/audit").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setSsvc(p.summary ?? null);
        setSla(s.summary ?? null);

        const statuses: ComplianceStatus[] = Array.isArray(c) ? c : [];
        const map: Record<string, CompStatus> = {};
        for (const st of statuses) map[`${st.framework}:${st.requirement_id}`] = st.status;
        setCoverage(
          FRAMEWORKS.map((fw) => ({
            short: fw.short,
            pct: coveragePct(fw.requirements.map((r) => map[`${fw.id}:${r.id}`] ?? "gap")),
          }))
        );
        setAudit(Array.isArray(a) ? a.slice(0, 5) : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-44 w-full" />)}
      </div>
    );
  }

  return (
    <div className="stagger grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      {/* SSVC triage */}
      <CenterCard href="/prioritize" icon={<Crosshair className="w-4 h-4 text-primary" />} title="Triage (SSVC)">
        <div className="flex items-end gap-1 mb-3">
          <span className="text-3xl font-bold" style={{ color: (ssvc?.act ?? 0) > 0 ? "#ef4444" : undefined }}>{ssvc?.act ?? 0}</span>
          <span className="text-xs text-muted-foreground mb-1">need to Act now</span>
        </div>
        <div className="space-y-1.5">
          {DECISIONS.map((d) => {
            const v = d === "Act" ? ssvc?.act : d === "Attend" ? ssvc?.attend : d === "Track*" ? ssvc?.track_star : ssvc?.track;
            const total = ssvc?.total || 1;
            return (
              <div key={d} className="flex items-center gap-2">
                <span className="text-[10px] w-12 text-muted-foreground">{DECISION_META[d].label}</span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.235 0.005 286)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${((v ?? 0) / total) * 100}%`, background: DECISION_META[d].color }} />
                </div>
                <span className="text-[11px] font-semibold w-5 text-right">{v ?? 0}</span>
              </div>
            );
          })}
        </div>
      </CenterCard>

      {/* SLA compliance */}
      <CenterCard href="/sla" icon={<Timer className="w-4 h-4 text-primary" />} title="SLA Compliance">
        <div className="flex items-end gap-1 mb-3">
          <span className="text-3xl font-bold" style={{ color: (sla?.compliance_pct ?? 0) >= 80 ? "#22c55e" : (sla?.compliance_pct ?? 0) >= 50 ? "#eab308" : "#ef4444" }}>
            {sla?.compliance_pct ?? 0}%
          </span>
          <span className="text-xs text-muted-foreground mb-1">within deadline</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "oklch(0.235 0.005 286)" }}>
          <div className="h-full rounded-full" style={{ width: `${sla?.compliance_pct ?? 0}%`, background: "linear-gradient(90deg,#10b981,#34d399)" }} />
        </div>
        <div className="flex gap-4 text-xs">
          <span className="text-muted-foreground">Breached <strong className="text-red-400">{sla?.breached ?? 0}</strong></span>
          <span className="text-muted-foreground">Due soon <strong className="text-orange-400">{sla?.due_soon ?? 0}</strong></span>
        </div>
      </CenterCard>

      {/* Compliance coverage */}
      <CenterCard href="/compliance" icon={<ShieldCheck className="w-4 h-4 text-primary" />} title="Compliance">
        <div className="space-y-3 mt-1">
          {coverage.map((c) => (
            <div key={c.short}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-muted-foreground">{c.short}</span>
                <span className="text-[11px] font-semibold" style={{ color: covColor(c.pct) }}>{c.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "oklch(0.235 0.005 286)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, background: covColor(c.pct) }} />
              </div>
            </div>
          ))}
        </div>
      </CenterCard>

      {/* Recent activity */}
      <CenterCard href="/data" icon={<ScrollText className="w-4 h-4 text-primary" />} title="Recent Activity">
        {audit.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2">No activity yet.</p>
        ) : (
          <div className="space-y-2 mt-1">
            {audit.map((a) => (
              <div key={a.id} className="flex items-start gap-2">
                <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded flex-shrink-0"
                  style={{ background: `${ACTION_COLOR[a.action] ?? "#6b7280"}1a`, color: ACTION_COLOR[a.action] ?? "#6b7280" }}>
                  {ACTION_ICON[a.action] ?? <ScrollText className="w-3 h-3" />}
                </span>
                <p className="text-[11px] leading-snug line-clamp-2 flex-1">{a.summary}</p>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CenterCard>
    </div>
  );
}

function CenterCard({ href, icon, title, children }: { href: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block">
      <Card style={PANEL} className="h-full">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <CardTitle className="text-[13px] font-semibold flex items-center gap-2">{icon} {title}</CardTitle>
          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </Link>
  );
}

function covColor(pct: number): string {
  if (pct >= 75) return "#22c55e";
  if (pct >= 50) return "#eab308";
  if (pct >= 25) return "#f97316";
  return "#ef4444";
}
