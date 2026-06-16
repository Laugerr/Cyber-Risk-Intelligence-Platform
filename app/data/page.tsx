"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download, Upload, ScrollText, Trash2, RefreshCw, FileSpreadsheet,
  Plus, Pencil, Database, Link2, Check, FileUp,
} from "lucide-react";
import { toCsv, parseCsv } from "@/lib/csv";
import type { AuditLog } from "@/lib/types";
import { toast } from "sonner";

const PANEL = { background: "oklch(0.13 0.04 328)", border: "1px solid oklch(1 0 0 / 8%)" } as const;

const ACTION_META: Record<string, { icon: React.ReactNode; color: string }> = {
  create: { icon: <Plus className="w-3.5 h-3.5" />, color: "#22c55e" },
  update: { icon: <Pencil className="w-3.5 h-3.5" />, color: "#3b82f6" },
  delete: { icon: <Trash2 className="w-3.5 h-3.5" />, color: "#ef4444" },
  import: { icon: <Upload className="w-3.5 h-3.5" />, color: "#a855f7" },
  seed: { icon: <Database className="w-3.5 h-3.5" />, color: "#f97316" },
  match: { icon: <Link2 className="w-3.5 h-3.5" />, color: "#f97316" },
  acknowledge: { icon: <Check className="w-3.5 h-3.5" />, color: "#22c55e" },
  sync: { icon: <RefreshCw className="w-3.5 h-3.5" />, color: "#3b82f6" },
};

const EXPORTS: { key: string; label: string; url: string; pick: (d: unknown) => Record<string, unknown>[] }[] = [
  { key: "assets", label: "Assets", url: "/api/assets", pick: (d) => d as Record<string, unknown>[] },
  { key: "vulnerabilities", label: "Vulnerabilities", url: "/api/vulnerabilities", pick: (d) => d as Record<string, unknown>[] },
  { key: "alerts", label: "Alerts", url: "/api/alerts", pick: (d) => d as Record<string, unknown>[] },
  { key: "controls", label: "Controls", url: "/api/controls", pick: (d) => d as Record<string, unknown>[] },
  { key: "software", label: "Software", url: "/api/inventory", pick: (d) => (d as { software?: Record<string, unknown>[] }).software ?? [] },
];

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function DataPage() {
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [importType, setImportType] = useState<"assets" | "software">("assets");
  const [parsed, setParsed] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAudit = useCallback(async () => {
    try {
      const data = await fetch("/api/audit").then((r) => r.json());
      setAudit(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAudit(); }, [loadAudit]);

  async function exportCsv(e: (typeof EXPORTS)[number]) {
    setExporting(e.key);
    try {
      const rows = e.pick(await fetch(e.url).then((r) => r.json()));
      if (rows.length === 0) { toast.info(`No ${e.label.toLowerCase()} to export`); return; }
      download(`crisp-${e.key}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
      toast.success(`Exported ${rows.length} ${e.label.toLowerCase()}`);
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting("");
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsv(String(reader.result));
      setParsed(rows);
      if (rows.length === 0) toast.error("No data rows found in CSV");
    };
    reader.readAsText(file);
  }

  async function runImport() {
    if (!parsed || parsed.length === 0) return;
    setImporting(true);
    const t = toast.loading(`Importing ${parsed.length} rows…`);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: importType, rows: parsed }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(`Imported ${data.imported}${data.skipped ? `, skipped ${data.skipped}` : ""}`, { id: t });
      setParsed(null); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      loadAudit();
    } catch (err) {
      toast.error(`${err}`, { id: t });
    } finally {
      setImporting(false);
    }
  }

  async function clearAudit() {
    setAudit([]);
    await fetch("/api/audit", { method: "DELETE" });
    toast.success("Audit log cleared");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full bg-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Data &amp; Audit Log</h1>
        </div>
        <p className="text-muted-foreground text-sm ml-3.5">
          Bulk CSV import/export and a full audit trail of every change
        </p>
      </div>

      {/* Export + Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card style={PANEL}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Download className="w-4 h-4 text-primary" /> Export to CSV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Download any dataset as a spreadsheet-ready CSV.</p>
            <div className="flex flex-wrap gap-2">
              {EXPORTS.map((e) => (
                <Button key={e.key} onClick={() => exportCsv(e)} disabled={exporting === e.key} variant="outline" size="sm" className="gap-1.5">
                  <FileSpreadsheet className={`w-3.5 h-3.5 ${exporting === e.key ? "animate-pulse" : ""}`} /> {e.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card style={PANEL}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Upload className="w-4 h-4 text-primary" /> Import from CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              {(["assets", "software"] as const).map((t) => (
                <button key={t} onClick={() => { setImportType(t); setParsed(null); setFileName(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all"
                  style={importType === t
                    ? { background: "oklch(0.62 0.20 32 / 12%)", border: "1px solid oklch(0.62 0.20 32 / 30%)", color: "oklch(0.7 0.15 32)" }
                    : { background: "oklch(0.16 0.03 328)", border: "1px solid oklch(1 0 0 / 8%)", color: "oklch(0.65 0 0)" }}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {importType === "assets"
                ? "Columns: name, asset_type, owner, criticality (1–5), internet_exposed (true/false)"
                : "Columns: asset (existing asset name), vendor, product, version"}
            </p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            <div className="flex items-center gap-2">
              <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm" className="gap-1.5">
                <FileUp className="w-3.5 h-3.5" /> Choose CSV
              </Button>
              {fileName && <span className="text-xs text-muted-foreground truncate">{fileName} · {parsed?.length ?? 0} rows</span>}
            </div>
            {parsed && parsed.length > 0 && (
              <Button onClick={runImport} disabled={importing} size="sm" className="w-full gap-1.5">
                <Upload className="w-3.5 h-3.5" /> {importing ? "Importing…" : `Import ${parsed.length} ${importType}`}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit log */}
      <Card style={PANEL}>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-primary" /> Audit Log
            {audit.length > 0 && <span className="text-[10px] text-muted-foreground">{audit.length} events</span>}
          </CardTitle>
          <div className="flex items-center gap-1">
            <button onClick={loadAudit} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-white/5">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
            {audit.length > 0 && (
              <button onClick={clearAudit} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-red-400 px-2 py-1 rounded hover:bg-red-500/10">
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="px-6 py-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : audit.length === 0 ? (
            <div className="py-14 text-center">
              <ScrollText className="w-8 h-8 mx-auto mb-3 text-muted-foreground opacity-20" />
              <p className="text-sm text-muted-foreground">No activity yet — changes you make will be logged here.</p>
            </div>
          ) : (
            audit.map((a, i) => {
              const meta = ACTION_META[a.action] ?? { icon: <ScrollText className="w-3.5 h-3.5" />, color: "#6b7280" };
              return (
                <div key={a.id} className="flex items-start gap-3 px-5 py-2.5"
                  style={{ borderBottom: i < audit.length - 1 ? "1px solid oklch(1 0 0 / 5%)" : "none" }}>
                  <span className="mt-0.5 flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0"
                    style={{ background: `${meta.color}1a`, color: meta.color }}>{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{a.summary}</p>
                    <p className="text-[10px] text-muted-foreground">
                      <span className="capitalize">{a.action}</span> · {a.entity} · {a.actor}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{timeAgo(a.created_at)}</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
