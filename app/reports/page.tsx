"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download } from "lucide-react";
import type { Alert, Asset, Control } from "@/lib/types";
import { estimateAle, calculateRosi } from "@/lib/rosi";

const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export default function ReportsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [selectedControlId, setSelectedControlId] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/alerts").then((r) => r.json()),
      fetch("/api/assets").then((r) => r.json()),
      fetch("/api/controls").then((r) => r.json()),
    ]).then(([al, as_, co]) => {
      const alertList = Array.isArray(al) ? al : [];
      const assetList = Array.isArray(as_) ? as_ : [];
      const controlList = Array.isArray(co) ? co : [];
      setAlerts(alertList);
      setAssets(assetList);
      setControls(controlList);
      if (controlList.length > 0) setSelectedControlId(String(controlList[0].id));
    });
  }, []);

  const totalRisk = alerts.reduce((s, a) => s + (a.risk_score || 0), 0);
  const ale = estimateAle(totalRisk);
  const selectedControl = controls.find((c) => String(c.id) === selectedControlId);
  const { riskReductionValue, rosi } = selectedControl
    ? calculateRosi(ale, selectedControl.annual_cost_eur, selectedControl.effectiveness_pct)
    : { riskReductionValue: 0, rosi: 0 };

  const sevCounts = Object.fromEntries(
    SEV_ORDER.map((s) => [s, alerts.filter((a) => a.severity === s).length])
  );
  const topAlerts = [...alerts].sort((a, b) => b.risk_score - a.risk_score).slice(0, 10);

  function generateHtml() {
    const stamp = new Date().toISOString();
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>CRISP Executive Risk Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
    h1 { color: #111; margin-bottom: 4px; }
    .muted { color: #666; font-size: 13px; }
    .kpi { display:flex; gap:16px; margin:20px 0; flex-wrap:wrap; }
    .card { border:1px solid #e0e0e0; border-radius:10px; padding:16px 20px; min-width:180px; }
    .card b { display:block; font-size:12px; color:#888; text-transform:uppercase; letter-spacing:.05em; margin-bottom:4px; }
    .card .val { font-size:24px; font-weight:700; }
    table { border-collapse:collapse; width:100%; margin-top:8px; }
    th, td { border:1px solid #ddd; padding:8px 12px; text-align:left; }
    th { background:#f5f5f5; font-size:12px; text-transform:uppercase; }
    .badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700; }
    .CRITICAL { background:#fef2f2; color:#dc2626; }
    .HIGH { background:#fff7ed; color:#ea580c; }
    .MEDIUM { background:#fefce8; color:#ca8a04; }
    .LOW { background:#f0fdf4; color:#16a34a; }
    .approve { background:#f0fdf4; color:#16a34a; padding:10px 14px; border-radius:6px; border:1px solid #86efac; }
    .reject { background:#fef2f2; color:#dc2626; padding:10px 14px; border-radius:6px; border:1px solid #fca5a5; }
    h2 { margin-top:32px; border-bottom:2px solid #f0f0f0; padding-bottom:8px; }
  </style>
</head>
<body>
  <h1>CRISP Executive Risk Report</h1>
  <p class="muted">Generated: ${stamp} UTC</p>

  <div class="kpi">
    <div class="card"><b>Assets</b><span class="val">${assets.length}</span></div>
    <div class="card"><b>Active Alerts</b><span class="val">${alerts.length}</span></div>
    <div class="card"><b>Total Risk Score</b><span class="val">${totalRisk.toFixed(2)}</span></div>
    <div class="card"><b>Estimated ALE</b><span class="val">€${ale.toLocaleString()}</span></div>
  </div>

  <h2>Severity Summary</h2>
  <table>
    <tr><th>Severity</th><th>Count</th></tr>
    ${SEV_ORDER.map((s) => `<tr><td><span class="badge ${s}">${s}</span></td><td>${sevCounts[s]}</td></tr>`).join("")}
  </table>

  ${selectedControl ? `
  <h2>Security Control ROSI — ${selectedControl.name}</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Annual Cost</td><td>€${selectedControl.annual_cost_eur.toLocaleString()}</td></tr>
    <tr><td>Effectiveness</td><td>${selectedControl.effectiveness_pct}%</td></tr>
    <tr><td>ALE Before</td><td>€${ale.toLocaleString()}</td></tr>
    <tr><td>Risk Reduction Value</td><td>€${riskReductionValue.toLocaleString()}</td></tr>
    <tr><td>ROSI</td><td>${(rosi * 100).toFixed(1)}%</td></tr>
  </table>
  <p class="${rosi >= 0 ? "approve" : "reject"}">
    <strong>Recommendation:</strong> ${rosi >= 0 ? `APPROVE — projected savings exceed cost (ROSI = ${(rosi * 100).toFixed(1)}%)` : `REVIEW — negative ROSI (${(rosi * 100).toFixed(1)}%)`}
  </p>` : ""}

  <h2>Top 10 Risks</h2>
  <table>
    <tr><th>Severity</th><th>Risk Score</th><th>Title</th><th>CVE</th></tr>
    ${topAlerts.map((a) => `<tr>
      <td><span class="badge ${a.severity}">${a.severity}</span></td>
      <td>${a.risk_score.toFixed(2)}</td>
      <td>${a.title}</td>
      <td>${a.cve ?? "—"}</td>
    </tr>`).join("")}
  </table>

  <h2>Notes</h2>
  <ul>
    <li>This is a simulated enterprise model for demo/portfolio use.</li>
    <li>Financial model can be calibrated to your target industry.</li>
    <li>ALE multiplier: €10,000 per risk point.</li>
  </ul>
</body>
</html>`;
  }

  function downloadReport() {
    const html = generateHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crisp_report_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate and download executive risk reports</p>
        </div>
        <Button onClick={downloadReport} className="gap-2" disabled={alerts.length === 0}>
          <Download className="w-4 h-4" />
          Download HTML Report
        </Button>
      </div>

      {/* Control selector */}
      {controls.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-muted-foreground">Include Control in Report</label>
              <Select value={selectedControlId} onValueChange={(v) => setSelectedControlId(v ?? "")}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {controls.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Report Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <PreviewKpi label="Assets" value={assets.length} />
            <PreviewKpi label="Active Alerts" value={alerts.length} />
            <PreviewKpi label="Total Risk Score" value={totalRisk.toFixed(2)} />
            <PreviewKpi label="Est. ALE" value={`€${ale.toLocaleString()}`} />
          </div>

          {/* Severity summary */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Severity Summary</h3>
            <div className="flex gap-3 flex-wrap">
              {SEV_ORDER.map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <SevBadge severity={s} />
                  <span className="text-sm font-semibold">{sevCounts[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ROSI summary */}
          {selectedControl && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">ROSI — {selectedControl.name}</h3>
              <div className={`p-3 rounded-lg text-sm border ${rosi >= 0 ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                <strong>Recommendation:</strong>{" "}
                {rosi >= 0
                  ? `APPROVE — projected savings exceed cost (ROSI = ${(rosi * 100).toFixed(1)}%)`
                  : `REVIEW — negative ROSI (${(rosi * 100).toFixed(1)}%)`}
              </div>
            </div>
          )}

          {/* Top risks */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Top 10 Risks</h3>
            {topAlerts.length === 0 ? (
              <p className="text-muted-foreground text-sm">No alerts yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left py-2">Severity</th>
                    <th className="text-left py-2">Score</th>
                    <th className="text-left py-2">Title</th>
                    <th className="text-left py-2">CVE</th>
                  </tr>
                </thead>
                <tbody>
                  {topAlerts.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-0">
                      <td className="py-2"><SevBadge severity={a.severity} /></td>
                      <td className="py-2 font-mono">{a.risk_score.toFixed(2)}</td>
                      <td className="py-2 text-muted-foreground truncate max-w-xs">{a.title}</td>
                      <td className="py-2 font-mono text-xs text-primary">{a.cve ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewKpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
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
