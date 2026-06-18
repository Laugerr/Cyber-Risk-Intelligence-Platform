"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Wand2, ClipboardCheck } from "lucide-react";
import { FRAMEWORKS, getFramework, coveragePct, type FrameworkId, type CompStatus } from "@/lib/frameworks";
import type { ComplianceStatus } from "@/lib/types";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { toast } from "sonner";

const PANEL = { background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" } as const;
const TOOLTIP_STYLE = { background: "oklch(0.205 0.005 286)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8, fontSize: 12 };

const STATUS_META: Record<CompStatus, { label: string; color: string; cls: string }> = {
  met: { label: "Met", color: "#22c55e", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  partial: { label: "Partial", color: "#eab308", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  gap: { label: "Gap", color: "#ef4444", cls: "bg-red-500/15 text-red-400 border-red-500/30" },
  na: { label: "N/A", color: "#6b7280", cls: "bg-gray-500/15 text-gray-400 border-gray-500/30" },
};
const CYCLE: CompStatus[] = ["met", "partial", "gap", "na"];

export default function CompliancePage() {
  const [statuses, setStatuses] = useState<Record<string, CompStatus>>({});
  const [active, setActive] = useState<FrameworkId>("nist-csf");
  const [loading, setLoading] = useState(true);
  const [assessing, setAssessing] = useState(false);

  const key = (fw: string, req: string) => `${fw}:${req}`;

  const load = useCallback(async () => {
    try {
      const data: ComplianceStatus[] = await fetch("/api/compliance").then((r) => r.json());
      const map: Record<string, CompStatus> = {};
      if (Array.isArray(data)) for (const s of data) map[key(s.framework, s.requirement_id)] = s.status;
      setStatuses(map);
    } catch {
      setStatuses({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const framework = getFramework(active)!;
  const statusFor = (reqId: string): CompStatus => statuses[key(active, reqId)] ?? "gap";

  async function setStatus(reqId: string, status: CompStatus) {
    setStatuses((prev) => ({ ...prev, [key(active, reqId)]: status }));
    await fetch("/api/compliance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ framework: active, requirement_id: reqId, status }),
    });
  }

  function cycle(reqId: string) {
    const cur = statusFor(reqId);
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    setStatus(reqId, next);
  }

  async function autoAssess() {
    setAssessing(true);
    const t = toast.loading("Auto-assessing controls against frameworks…");
    try {
      const res = await fetch("/api/compliance", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await load();
      toast.success(`Assessed ${data.assessed} requirements — ${data.met} met`, { id: t });
    } catch (err) {
      toast.error(`Failed: ${err}`, { id: t });
    } finally {
      setAssessing(false);
    }
  }

  const overall = useMemo(
    () => coveragePct(framework.requirements.map((r) => statusFor(r.id))),
    [framework, statuses] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const counts = useMemo(() => {
    const c: Record<CompStatus, number> = { met: 0, partial: 0, gap: 0, na: 0 };
    for (const r of framework.requirements) c[statusFor(r.id)]++;
    return c;
  }, [framework, statuses]); // eslint-disable-line react-hooks/exhaustive-deps

  const donutData = (Object.keys(counts) as CompStatus[])
    .map((s) => ({ name: STATUS_META[s].label, value: counts[s], status: s }))
    .filter((d) => d.value > 0);

  const categories = useMemo(() => {
    const byCat: Record<string, CompStatus[]> = {};
    for (const r of framework.requirements) (byCat[r.category] ??= []).push(statusFor(r.id));
    return Object.entries(byCat).map(([name, st]) => ({ name, coverage: coveragePct(st) }));
  }, [framework, statuses]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Compliance Mapping</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Map your security controls to NIST CSF, CIS Controls, and ISO 27001 coverage
          </p>
        </div>
        <Button onClick={autoAssess} disabled={assessing} size="sm" className="gap-2 h-9">
          <Wand2 className={`w-3.5 h-3.5 ${assessing ? "animate-pulse" : ""}`} />
          {assessing ? "Assessing…" : "Auto-Assess from Controls"}
        </Button>
      </div>

      {/* Framework tabs */}
      <div className="flex flex-wrap gap-2">
        {FRAMEWORKS.map((fw) => {
          const cov = coveragePct(fw.requirements.map((r) => statuses[key(fw.id, r.id)] ?? "gap"));
          const isActive = fw.id === active;
          return (
            <button
              key={fw.id}
              onClick={() => setActive(fw.id)}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={
                isActive
                  ? { background: "oklch(0.70 0.15 162 / 12%)", border: "1px solid oklch(0.70 0.15 162 / 30%)", color: "oklch(0.80 0.14 163)" }
                  : { background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.65 0 0)" }
              }
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{fw.short}</span>
              <span className="text-[10px] text-muted-foreground">{fw.version}</span>
              <span className="text-xs font-bold" style={{ color: covColor(cov) }}>{cov}%</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : (
        <>
          {/* Coverage overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Overall gauge */}
            <Card style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" /> {framework.short} Coverage
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-2">
                <div className="relative">
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={82} paddingAngle={2}>
                        {donutData.map((d) => <Cell key={d.status} fill={STATUS_META[d.status].color} />)}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-bold" style={{ color: covColor(overall) }}>{overall}%</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">covered</span>
                  </div>
                </div>
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3">
                  {(Object.keys(counts) as CompStatus[]).map((s) => (
                    <span key={s} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="w-2 h-2 rounded-full" style={{ background: STATUS_META[s].color }} />
                      {STATUS_META[s].label} <span className="font-semibold text-foreground">{counts[s]}</span>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Coverage by category */}
            <Card className="lg:col-span-2" style={PANEL}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Coverage by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categories} layout="vertical" margin={{ top: 0, right: 40, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "oklch(0.6 0 0)" }} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.75 0 0)" }} width={120} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "Coverage"]} cursor={{ fill: "oklch(1 0 0 / 4%)" }} />
                    <Bar dataKey="coverage" radius={[0, 4, 4, 0]}>
                      {categories.map((c, i) => <Cell key={i} fill={covColor(c.coverage)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Requirements list */}
          <Card style={PANEL}>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">{framework.name} — Requirements</CardTitle>
              <span className="text-[10px] text-muted-foreground">{framework.reference} · click a status to change</span>
            </CardHeader>
            <CardContent className="p-0">
              {framework.requirements.map((req, i) => {
                const st = statusFor(req.id);
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-white/[0.02] transition-colors gap-4"
                    style={{ borderBottom: i < framework.requirements.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-[11px] font-mono text-muted-foreground w-16 flex-shrink-0">{req.id}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{req.title}</p>
                        <p className="text-[11px] text-muted-foreground">{req.category}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => cycle(req.id)}
                      title="Click to change status"
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-md border flex-shrink-0 transition-transform hover:scale-105 ${STATUS_META[st].cls}`}
                    >
                      {STATUS_META[st].label}
                    </button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function covColor(pct: number): string {
  if (pct >= 75) return "#22c55e";
  if (pct >= 50) return "#eab308";
  if (pct >= 25) return "#f97316";
  return "#ef4444";
}
