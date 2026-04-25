"use client";

import { usePathname } from "next/navigation";
import { Shield, LayoutDashboard, Server, Bug, TrendingUp, FileText } from "lucide-react";

const PAGES: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  "/": { label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, desc: "Real-time cyber risk overview" },
  "/assets": { label: "Assets", icon: <Server className="w-4 h-4" />, desc: "Manage your asset inventory" },
  "/vulnerabilities": { label: "Vulnerabilities", icon: <Bug className="w-4 h-4" />, desc: "Track and triage CVEs" },
  "/risk": { label: "Risk & ROSI", icon: <TrendingUp className="w-4 h-4" />, desc: "Quantify risk and model security investment" },
  "/reports": { label: "Reports", icon: <FileText className="w-4 h-4" />, desc: "Generate executive risk reports" },
};

export function Header() {
  const pathname = usePathname();
  const page = PAGES[pathname] ?? PAGES["/"];

  return (
    <div
      className="flex items-center justify-between px-8 py-4 mb-2"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg text-primary"
          style={{ background: "oklch(0.62 0.20 32 / 12%)", border: "1px solid oklch(0.62 0.20 32 / 20%)" }}
        >
          {page.icon}
        </div>
        <div>
          <h2 className="font-semibold text-sm text-foreground">{page.label}</h2>
          <p className="text-[11px] text-muted-foreground">{page.desc}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: "oklch(0.62 0.20 32 / 8%)", border: "1px solid oklch(0.62 0.20 32 / 15%)" }}
        >
          <Shield className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">CRISP v2.0</span>
        </div>
      </div>
    </div>
  );
}
