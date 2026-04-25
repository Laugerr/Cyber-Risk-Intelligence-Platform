"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Server, Monitor, Cloud, Network, Globe, Database, Box, ShieldAlert, ShieldCheck } from "lucide-react";
import type { Asset, AssetType } from "@/lib/types";
import { toast } from "sonner";

const ASSET_TYPES: AssetType[] = ["Server", "Workstation", "Cloud", "Network", "WebApp", "Database", "Other"];

const TYPE_ICON: Record<string, React.ReactNode> = {
  Server: <Server className="w-3.5 h-3.5" />,
  Workstation: <Monitor className="w-3.5 h-3.5" />,
  Cloud: <Cloud className="w-3.5 h-3.5" />,
  Network: <Network className="w-3.5 h-3.5" />,
  WebApp: <Globe className="w-3.5 h-3.5" />,
  Database: <Database className="w-3.5 h-3.5" />,
  Other: <Box className="w-3.5 h-3.5" />,
};

const defaultForm = {
  name: "",
  asset_type: "Server" as AssetType,
  owner: "",
  criticality: 3,
  internet_exposed: false,
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const data = await fetch("/api/assets").then((r) => r.json());
    setAssets(Array.isArray(data) ? data : []);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.owner.trim()) { setError("Name and owner are required."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm(defaultForm);
      setOpen(false);
      toast.success("Asset added successfully");
      await load();
    } else {
      const d = await res.json();
      setError(d.error || "Failed to save.");
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this asset and all its vulnerabilities?")) return;
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    toast.success("Asset deleted");
    await load();
  }

  const exposed = assets.filter((a) => a.internet_exposed).length;
  const critical = assets.filter((a) => a.criticality >= 4).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
          <p className="text-muted-foreground text-sm mt-1">{assets.length} asset{assets.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" className="gap-2" />}>
            <Plus className="w-4 h-4" />Add Asset
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>New Asset</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. prod-web-01" />
                </div>
                <div className="space-y-1.5">
                  <Label>Owner *</Label>
                  <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="e.g. Security Team" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.asset_type} onValueChange={(v) => setForm({ ...form, asset_type: (v ?? "Other") as AssetType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Criticality (1–5)</Label>
                  <Input type="number" min={1} max={5} value={form.criticality} onChange={(e) => setForm({ ...form, criticality: Number(e.target.value) })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="exposed" checked={form.internet_exposed} onChange={(e) => setForm({ ...form, internet_exposed: e.target.checked })} className="accent-primary" />
                <Label htmlFor="exposed">Internet Exposed</Label>
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving..." : "Add Asset"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats row */}
      {assets.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Assets" value={assets.length} icon={<Server className="w-4 h-4" />} />
          <StatCard label="Internet Exposed" value={exposed} icon={<ShieldAlert className="w-4 h-4" />} highlight={exposed > 0} />
          <StatCard label="High / Critical" value={critical} icon={<ShieldCheck className="w-4 h-4" />} highlight={critical > 0} />
        </div>
      )}

      <Card style={{ background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" }}>
        <CardContent className="p-0">
          {assets.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 opacity-20" style={{ background: "oklch(0.62 0.20 32 / 15%)" }}>
                <Server className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">No assets yet</p>
              <p className="text-xs mt-1">Add your first asset or load demo data.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }} className="text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3">Name</th>
                  <th className="text-left px-5 py-3">Type</th>
                  <th className="text-left px-5 py-3">Owner</th>
                  <th className="text-left px-5 py-3">Criticality</th>
                  <th className="text-left px-5 py-3">Exposure</th>
                  <th className="text-left px-5 py-3">Added</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid oklch(1 0 0 / 5%)" }} className="last:border-0 hover:bg-white/[0.03] transition-colors">
                    <td className="px-5 py-3.5 font-medium">{a.name}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        {TYPE_ICON[a.asset_type] ?? TYPE_ICON.Other}
                        {a.asset_type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{a.owner}</td>
                    <td className="px-5 py-3.5">
                      <CriticalityBar value={a.criticality} />
                    </td>
                    <td className="px-5 py-3.5">
                      {a.internet_exposed ? (
                        <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">Exposed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Internal</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(a.id!)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
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

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
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

function CriticalityBar({ value }: { value: number }) {
  const colors = ["", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444"];
  const labels = ["", "Low", "Low-Med", "Medium", "High", "Critical"];
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-2 h-3 rounded-sm"
            style={{ background: i <= value ? colors[value] : "oklch(1 0 0 / 10%)" }}
          />
        ))}
      </div>
      <span className="text-xs font-medium" style={{ color: colors[value] }}>{labels[value]}</span>
    </div>
  );
}
