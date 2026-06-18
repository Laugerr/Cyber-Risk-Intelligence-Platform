"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Boxes, Server, Database, Link2, Plus, Trash2, Wand2, ShieldAlert } from "lucide-react";
import type { Asset, AssetSoftware } from "@/lib/types";
import { toast } from "sonner";

const PANEL = { background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" } as const;

type SoftwareView = AssetSoftware & { asset_name: string };
interface PreviewItem {
  cve: string; title: string; vendor: string; product: string;
  cvss: number; epss_score: number; known_exploited: boolean;
  matched: { asset_id: number; asset_name: string; linked: boolean }[];
}
type Summary = { total_software: number; assets_with_software: number; feed_size: number; new_matches: number };

export default function InventoryPage() {
  const [software, setSoftware] = useState<SoftwareView[]>([]);
  const [preview, setPreview] = useState<PreviewItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);

  const [form, setForm] = useState({ asset_id: "", vendor: "", product: "", version: "" });

  const load = useCallback(async () => {
    try {
      const [inv, a] = await Promise.all([
        fetch("/api/inventory").then((r) => r.json()),
        fetch("/api/assets").then((r) => r.json()),
      ]);
      setSoftware(Array.isArray(inv.software) ? inv.software : []);
      setPreview(Array.isArray(inv.preview) ? inv.preview : []);
      setSummary(inv.summary ?? null);
      setAssets(Array.isArray(a) ? a : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runMatch() {
    setMatching(true);
    const t = toast.loading("Matching CVE feed against software inventory…");
    try {
      const res = await fetch("/api/inventory/match", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      await load();
      toast.success(
        data.created_vulns > 0
          ? `Linked ${data.created_vulns} new CVE${data.created_vulns > 1 ? "s" : ""} across matched assets`
          : "No new CVEs to link — inventory already up to date",
        { id: t }
      );
    } catch (err) {
      toast.error(`Failed: ${err}`, { id: t });
    } finally {
      setMatching(false);
    }
  }

  async function addSoftware() {
    if (!form.asset_id || !form.product.trim()) {
      toast.error("Pick an asset and enter a product");
      return;
    }
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, asset_id: Number(form.asset_id) }),
    });
    if (res.ok) {
      setForm({ asset_id: form.asset_id, vendor: "", product: "", version: "" });
      toast.success("Software added");
      load();
    } else {
      toast.error("Failed to add software");
    }
  }

  async function removeSoftware(id: number) {
    setSoftware((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/inventory?id=${id}`, { method: "DELETE" });
    load();
  }

  // Group software by asset
  const byAsset = software.reduce((acc: Record<string, SoftwareView[]>, s) => {
    (acc[s.asset_name] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-6 rounded-full bg-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Software Inventory</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-3.5">
            Track installed software (CPE) and auto-match incoming CVE advisories to affected assets
          </p>
        </div>
        <Button onClick={runMatch} disabled={matching} size="sm" className="gap-2 h-9">
          <Wand2 className={`w-3.5 h-3.5 ${matching ? "animate-pulse" : ""}`} />
          {matching ? "Matching…" : "Run Auto-Match"}
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={<Boxes className="w-4 h-4" />} iconBg="bg-blue-500/10" iconColor="text-blue-400"
              value={summary?.total_software ?? 0} label="Software Components" sub="tracked with CPE" />
            <Kpi icon={<Server className="w-4 h-4" />} iconBg="bg-green-500/10" iconColor="text-green-400"
              value={summary?.assets_with_software ?? 0} label="Assets Covered" sub="have inventory" />
            <Kpi icon={<Database className="w-4 h-4" />} iconBg="bg-purple-500/10" iconColor="text-purple-400"
              value={summary?.feed_size ?? 0} label="CVE Feed" sub="advisories tracked" />
            <Kpi icon={<Link2 className="w-4 h-4" />} iconBg="bg-orange-500/10" iconColor="text-orange-400"
              value={summary?.new_matches ?? 0} label="Unlinked Matches" sub="ready to auto-link"
              valueColor={(summary?.new_matches ?? 0) > 0 ? "#f97316" : undefined} />
          </div>

          {/* Match preview */}
          <Card style={PANEL}>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-primary" /> CVE Feed → Asset Matches
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">{preview.length} advisories matched your inventory</span>
            </CardHeader>
            <CardContent className="p-0">
              {preview.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No matches — add software components below, or load demo data to populate inventory.
                </div>
              ) : (
                preview.map((adv, idx) => (
                  <div key={adv.cve} className="px-5 py-3 hover:bg-white/[0.02] transition-colors"
                    style={{ borderBottom: idx < preview.length - 1 ? "1px solid oklch(1 0 0 / 6%)" : "none" }}>
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="font-mono text-xs">{adv.cve}</span>
                      {adv.known_exploited && <Badge variant="outline" className="text-[9px] font-bold bg-red-500/15 text-red-400 border-red-500/30">KEV</Badge>}
                      <span className="text-[11px] text-muted-foreground">CVSS {adv.cvss} · EPSS {(adv.epss_score * 100).toFixed(0)}%</span>
                      <span className="text-xs text-muted-foreground truncate">· {adv.vendor} {adv.product}</span>
                    </div>
                    <p className="text-sm mb-2 truncate">{adv.title}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {adv.matched.map((m) => (
                        <span key={m.asset_id}
                          className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border ${
                            m.linked
                              ? "bg-white/[0.03] text-muted-foreground border-white/10"
                              : "bg-orange-500/15 text-orange-400 border-orange-500/30"
                          }`}>
                          {m.linked ? <Link2 className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                          {m.asset_name}
                          <span className="opacity-60">{m.linked ? "linked" : "new"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Add software */}
          <Card style={PANEL}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Add Software Component
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <select
                  value={form.asset_id}
                  onChange={(e) => setForm({ ...form, asset_id: e.target.value })}
                  className="sm:col-span-3 h-9 rounded-md px-3 text-sm bg-transparent outline-none"
                  style={{ background: "oklch(0.205 0.004 286)", border: "1px solid oklch(1 0 0 / 10%)" }}
                >
                  <option value="">Select asset…</option>
                  {assets.map((a) => <option key={a.id} value={a.id} className="bg-[#1a1320]">{a.name}</option>)}
                </select>
                <Input className="sm:col-span-2 h-9" placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                <Input className="sm:col-span-3 h-9" placeholder="Product" value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} />
                <Input className="sm:col-span-2 h-9" placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
                <Button onClick={addSoftware} size="sm" className="sm:col-span-2 h-9 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Inventory by asset */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.keys(byAsset).length === 0 ? (
              <Card style={PANEL} className="lg:col-span-2">
                <CardContent className="py-12 text-center text-sm text-muted-foreground">
                  No software tracked yet — load demo data or add components above.
                </CardContent>
              </Card>
            ) : (
              Object.entries(byAsset).map(([assetName, list]) => (
                <Card key={assetName} style={PANEL}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Server className="w-4 h-4 text-primary" /> {assetName}
                      <span className="text-[10px] text-muted-foreground font-normal">{list.length} components</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {list.map((s, i) => (
                      <div key={s.id} className="flex items-center justify-between px-5 py-2.5 group hover:bg-white/[0.02]"
                        style={{ borderBottom: i < list.length - 1 ? "1px solid oklch(1 0 0 / 5%)" : "none" }}>
                        <div className="min-w-0">
                          <p className="text-sm">
                            <span className="text-muted-foreground">{s.vendor}</span> {s.product}{" "}
                            {s.version && <span className="text-xs text-muted-foreground">v{s.version}</span>}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{s.cpe}</p>
                        </div>
                        <button onClick={() => removeSoftware(s.id!)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}
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
