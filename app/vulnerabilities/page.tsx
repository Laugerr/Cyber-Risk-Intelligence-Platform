"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Bug, Search, Flame, ShieldOff, BarChart2 } from "lucide-react";
import type { Asset, Vulnerability } from "@/lib/types";
import { calculateRisk } from "@/lib/scoring";
import { toast } from "sonner";

const defaultForm = {
  asset_id: "",
  cve: "",
  title: "",
  cvss: 5,
  known_exploited: false,
  epss_score: "",
};

export default function VulnerabilitiesPage() {
  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [nvdSearch, setNvdSearch] = useState("");
  const [nvdResults, setNvdResults] = useState<{ cve_id: string; description: string; cvss: number | null }[]>([]);
  const [nvdLoading, setNvdLoading] = useState(false);

  async function load() {
    const [v, a] = await Promise.all([
      fetch("/api/vulnerabilities").then((r) => r.json()),
      fetch("/api/assets").then((r) => r.json()),
    ]);
    setVulns(Array.isArray(v) ? v : []);
    setAssets(Array.isArray(a) ? a : []);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.asset_id || !form.cve.trim() || !form.title.trim()) { setError("Asset, CVE, and title are required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/vulnerabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        asset_id: Number(form.asset_id),
        epss_score: form.epss_score !== "" ? Number(form.epss_score) : null,
      }),
    });
    if (res.ok) {
      setForm(defaultForm);
      setNvdResults([]);
      setNvdSearch("");
      setOpen(false);
      toast.success("Vulnerability added and alert generated");
      await load();
    } else {
      const d = await res.json();
      setError(d.error || "Failed to save.");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this vulnerability?")) return;
    await fetch(`/api/vulnerabilities/${id}`, { method: "DELETE" });
    toast.success("Vulnerability deleted");
    await load();
  }

  async function searchNvd() {
    if (!nvdSearch.trim()) return;
    setNvdLoading(true);
    const data = await fetch(`/api/nvd?q=${encodeURIComponent(nvdSearch)}`).then((r) => r.json());
    setNvdResults(Array.isArray(data) ? data : []);
    setNvdLoading(false);
  }

  function fillFromNvd(item: { cve_id: string; description: string; cvss: number | null }) {
    setForm((f) => ({
      ...f,
      cve: item.cve_id,
      title: item.description.slice(0, 120),
      cvss: item.cvss ?? f.cvss,
    }));
    setNvdResults([]);
  }

  const assetMap = Object.fromEntries(assets.map((a) => [a.id!, a]));
  const filtered = vulns.filter((v) =>
    !search || v.cve.toLowerCase().includes(search.toLowerCase()) || v.title.toLowerCase().includes(search.toLowerCase())
  );

  const kevCount = vulns.filter((v) => v.known_exploited).length;
  const criticalCount = vulns.filter((v) => {
    const a = assetMap[v.asset_id];
    const r = a ? calculateRisk(v.cvss, a.criticality, a.internet_exposed, v.known_exploited, false, v.epss_score) : null;
    return r?.severity === "CRITICAL";
  }).length;
  const avgCvss = vulns.length > 0 ? vulns.reduce((s, v) => s + v.cvss, 0) / vulns.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vulnerabilities</h1>
          <p className="text-muted-foreground text-sm mt-1">{vulns.length} vulnerability{vulns.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-2" />}>
            <Plus className="w-4 h-4" />Add Vulnerability
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg">
            <DialogHeader>
              <DialogTitle>New Vulnerability</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Search NVD (optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={nvdSearch}
                    onChange={(e) => setNvdSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchNvd())}
                    placeholder="keyword or CVE-XXXX-XXXXX"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={searchNvd} disabled={nvdLoading}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {nvdResults.length > 0 && (
                  <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                    {nvdResults.map((r) => (
                      <button
                        key={r.cve_id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-secondary text-xs"
                        onClick={() => fillFromNvd(r)}
                      >
                        <span className="font-mono text-primary mr-2">{r.cve_id}</span>
                        <span className="text-muted-foreground">{r.description.slice(0, 80)}…</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Asset *</Label>
                <Select value={form.asset_id} onValueChange={(v) => setForm({ ...form, asset_id: v ?? "" })}>
                  <SelectTrigger><SelectValue placeholder="Select asset" /></SelectTrigger>
                  <SelectContent>
                    {assets.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>CVE ID *</Label>
                  <Input value={form.cve} onChange={(e) => setForm({ ...form, cve: e.target.value })} placeholder="CVE-2024-1234" className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label>CVSS (0–10)</Label>
                  <Input type="number" min={0} max={10} step={0.1} value={form.cvss} onChange={(e) => setForm({ ...form, cvss: Number(e.target.value) })} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Brief description" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>EPSS Score (0–1)</Label>
                  <Input type="number" min={0} max={1} step={0.001} value={form.epss_score} onChange={(e) => setForm({ ...form, epss_score: e.target.value })} placeholder="optional" />
                </div>
                <div className="flex items-end pb-1">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="exploited" checked={form.known_exploited} onChange={(e) => setForm({ ...form, known_exploited: e.target.checked })} className="accent-primary" />
                    <Label htmlFor="exploited">Known Exploited</Label>
                  </div>
                </div>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving..." : "Add Vulnerability"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {vulns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="KEV (Active Exploits)" value={kevCount} icon={<Flame className="w-4 h-4" />} highlight={kevCount > 0} />
          <StatCard label="Critical Severity" value={criticalCount} icon={<ShieldOff className="w-4 h-4" />} highlight={criticalCount > 0} />
          <StatCard label="Avg CVSS Score" value={avgCvss.toFixed(1)} icon={<BarChart2 className="w-4 h-4" />} highlight={avgCvss >= 7} />
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Filter by CVE or title…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 opacity-20" style={{ background: "oklch(0.62 0.20 32 / 15%)" }}>
                <Bug className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">{search ? "No results matching your filter." : "No vulnerabilities yet."}</p>
              <p className="text-xs mt-1">{search ? "Try a different keyword." : "Add a vulnerability or load demo data."}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }} className="text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">CVE</th>
                  <th className="text-left px-5 py-3">Title</th>
                  <th className="text-left px-5 py-3">Asset</th>
                  <th className="text-left px-5 py-3">CVSS</th>
                  <th className="text-left px-5 py-3">EPSS</th>
                  <th className="text-left px-5 py-3">Risk Score</th>
                  <th className="text-left px-5 py-3">Severity</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => {
                  const asset = assetMap[v.asset_id];
                  const risk = asset
                    ? calculateRisk(v.cvss, asset.criticality, asset.internet_exposed, v.known_exploited, false, v.epss_score)
                    : null;
                  return (
                    <tr key={v.id} style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }} className="last:border-0 hover:bg-white/[0.03] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-primary text-xs">{v.cve}</span>
                          {v.known_exploited && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">KEV</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 max-w-xs truncate text-muted-foreground">{v.title}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{asset?.name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <CvssBar value={v.cvss} />
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">{v.epss_score != null ? v.epss_score.toFixed(3) : "—"}</td>
                      <td className="px-5 py-3.5 font-mono font-semibold">{risk ? risk.risk_score.toFixed(2) : "—"}</td>
                      <td className="px-5 py-3.5">{risk ? <SevBadge severity={risk.severity} /> : "—"}</td>
                      <td className="px-5 py-3.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(v.id!)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string | number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-2xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${highlight ? "text-primary" : "text-muted-foreground"}`} style={{ background: highlight ? "oklch(0.62 0.20 32 / 12%)" : "oklch(1 0 0 / 5%)" }}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CvssBar({ value }: { value: number }) {
  const pct = (value / 10) * 100;
  const color = value >= 9 ? "#ef4444" : value >= 7 ? "#f97316" : value >= 4 ? "#eab308" : "#22c55e";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold tabular-nums" style={{ color }}>{value.toFixed(1)}</span>
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
  return <Badge variant="outline" className={`text-[10px] font-bold ${map[severity] ?? ""}`}>{severity}</Badge>;
}
