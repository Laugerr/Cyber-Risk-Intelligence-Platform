"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Server } from "lucide-react";
import type { Asset, AssetType } from "@/lib/types";
import { toast } from "sonner";

const ASSET_TYPES: AssetType[] = ["Server", "Workstation", "Cloud", "Network", "WebApp", "Database", "Other"];

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

      <Card style={{ background: "oklch(0.12 0 0)", border: "1px solid oklch(1 0 0 / 8%)" }}>
        <CardContent className="p-0">
          {assets.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No assets yet — add your first one.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-left px-4 py-3">Owner</th>
                  <th className="text-left px-4 py-3">Criticality</th>
                  <th className="text-left px-4 py-3">Exposure</th>
                  <th className="text-left px-4 py-3">Added</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.asset_type}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.owner}</td>
                    <td className="px-4 py-3">
                      <CriticalityBadge value={a.criticality} />
                    </td>
                    <td className="px-4 py-3">
                      {a.internet_exposed ? (
                        <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-400 border-orange-500/30">Exposed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Internal</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
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

function CriticalityBadge({ value }: { value: number }) {
  const map = ["", "text-green-400", "text-lime-400", "text-yellow-400", "text-orange-400", "text-red-400"];
  const labels = ["", "Low", "Low-Med", "Medium", "High", "Critical"];
  return <span className={`font-semibold text-xs ${map[value]}`}>{value} — {labels[value]}</span>;
}
