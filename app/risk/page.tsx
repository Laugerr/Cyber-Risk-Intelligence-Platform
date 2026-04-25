"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp } from "lucide-react";
import type { Alert, Control } from "@/lib/types";
import { estimateAle, calculateRosi } from "@/lib/rosi";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";

const defaultForm = { name: "", annual_cost_eur: 5000, effectiveness_pct: 30, notes: "" };

export default function RiskPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [al, co] = await Promise.all([
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/controls").then((r) => r.json()),
    ]);
    const alertList = Array.isArray(al) ? al : [];
    const controlList = Array.isArray(co) ? co : [];
    setAlerts(alertList);
    setControls(controlList);
    if (!selectedControlId && controlList.length > 0) {
      setSelectedControlId(String(controlList[0].id));
    }
  }

  useEffect(() => { load(); }, []);

  const totalRisk = alerts.reduce((s, a) => s + (a.risk_score || 0), 0);
  const ale = estimateAle(totalRisk);

  const selectedControl = controls.find((c) => String(c.id) === selectedControlId);
  const { riskReductionValue, rosi } = selectedControl
    ? calculateRosi(ale, selectedControl.annual_cost_eur, selectedControl.effectiveness_pct)
    : { riskReductionValue: 0, rosi: 0 };
  const aleAfter = ale - riskReductionValue;

  const aleChartData = selectedControl
    ? [
        { name: "Before Control", ALE: ale },
        { name: "After Control", ALE: Math.max(0, aleAfter) },
      ]
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/controls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(defaultForm);
      setOpen(false);
      toast.success("Security control added");
      await load();
    } else {
      const d = await res.json();
      setError(d.error || "Failed to save.");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Risk & ROSI</h1>
        <p className="text-muted-foreground text-sm mt-1">Risk quantification and security investment modeling</p>
      </div>

      {/* Risk KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total Risk Score" value={totalRisk.toFixed(2)} color="text-orange-400" />
        <KpiCard label="Est. ALE (€)" value={`€${ale.toLocaleString()}`} color="text-red-400" />
        <KpiCard label="Risk Reduction (€)" value={selectedControl ? `€${riskReductionValue.toLocaleString()}` : "—"} color="text-green-400" />
        <KpiCard
          label="ROSI"
          value={selectedControl ? `${(rosi * 100).toFixed(1)}%` : "—"}
          color={rosi >= 0 ? "text-green-400" : "text-red-400"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ROSI panel */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Security Control Evaluation</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" />}>
                <Plus className="w-3.5 h-3.5" />Add Control
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle>New Security Control</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MFA Deployment" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Annual Cost (€)</Label>
                      <Input type="number" min={0} value={form.annual_cost_eur} onChange={(e) => setForm({ ...form, annual_cost_eur: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Effectiveness (%)</Label>
                      <Input type="number" min={0} max={100} value={form.effectiveness_pct} onChange={(e) => setForm({ ...form, effectiveness_pct: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving..." : "Add Control"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            {controls.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No controls yet.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Select Control to Evaluate</Label>
                  <Select value={selectedControlId} onValueChange={(v) => setSelectedControlId(v ?? "")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {controls.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selectedControl && (
                  <div className="space-y-2 text-sm">
                    <Row label="Annual Cost" value={`€${selectedControl.annual_cost_eur.toLocaleString()}`} />
                    <Row label="Effectiveness" value={`${selectedControl.effectiveness_pct}%`} />
                    <Row label="ALE Before" value={`€${ale.toLocaleString()}`} />
                    <Row label="ALE After" value={`€${Math.max(0, aleAfter).toLocaleString()}`} />
                    <Row label="Risk Reduction Value" value={`€${riskReductionValue.toLocaleString()}`} />
                    <Row
                      label="ROSI"
                      value={`${(rosi * 100).toFixed(1)}%`}
                      highlight={rosi >= 0 ? "green" : "red"}
                    />
                    <div className={`mt-3 p-3 rounded-lg text-xs font-medium border ${rosi >= 0 ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                      {rosi >= 0 ? `APPROVE — projected savings exceed cost (ROSI = ${(rosi * 100).toFixed(1)}%)` : `REVIEW — negative ROSI (${(rosi * 100).toFixed(1)}%). Consider cheaper or more effective control.`}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ALE chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">ALE Before vs After Control</CardTitle>
          </CardHeader>
          <CardContent>
            {aleChartData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">Select a control to see comparison.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={aleChartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 7%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.62 0.03 328)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "oklch(0.62 0.03 328)" }} tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v) => [`€${Number(v).toLocaleString()}`, "ALE"]}
                    contentStyle={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 10%)", borderRadius: 8 }}
                    labelStyle={{ color: "oklch(0.97 0 0)" }}
                  />
                  <Bar dataKey="ALE" fill="oklch(0.62 0.20 32)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Controls table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Registered Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {controls.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No controls registered.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Annual Cost</th>
                  <th className="text-left px-4 py-3">Effectiveness</th>
                  <th className="text-left px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {controls.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">€{c.annual_cost_eur.toLocaleString()}</td>
                    <td className="px-4 py-3">{c.effectiveness_pct}%</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{c.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-muted-foreground text-xs uppercase tracking-wider mb-2">{label}</p>
        <p className={`text-2xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "green" | "red" }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${highlight === "green" ? "text-green-400" : highlight === "red" ? "text-red-400" : ""}`}>{value}</span>
    </div>
  );
}
