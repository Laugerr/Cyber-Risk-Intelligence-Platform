"use client";

import { usePathname } from "next/navigation";
import {
  Shield, LayoutDashboard, Server, Bug, TrendingUp, FileText, Menu,
  LineChart, ShieldCheck, Timer, Crosshair, Boxes, BellRing, Database, Grid3x3, Search,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";

const PAGES: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  "/": { label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, desc: "Real-time cyber risk overview" },
  "/assets": { label: "Assets", icon: <Server className="w-4 h-4" />, desc: "Manage your asset inventory" },
  "/inventory": { label: "Software Inventory", icon: <Boxes className="w-4 h-4" />, desc: "Track software and auto-match CVEs" },
  "/vulnerabilities": { label: "Vulnerabilities", icon: <Bug className="w-4 h-4" />, desc: "Track and triage CVEs" },
  "/prioritize": { label: "Smart Prioritization", icon: <Crosshair className="w-4 h-4" />, desc: "SSVC decision-based triage" },
  "/heatmap": { label: "Risk Heatmap", icon: <Grid3x3 className="w-4 h-4" />, desc: "Likelihood × impact risk matrix" },
  "/trends": { label: "Risk Trends", icon: <LineChart className="w-4 h-4" />, desc: "Historical posture and MTTR" },
  "/sla": { label: "SLA & Remediation", icon: <Timer className="w-4 h-4" />, desc: "Deadlines and breach tracking" },
  "/compliance": { label: "Compliance", icon: <ShieldCheck className="w-4 h-4" />, desc: "Framework coverage mapping" },
  "/risk": { label: "Risk & ROSI", icon: <TrendingUp className="w-4 h-4" />, desc: "Quantify risk and model security investment" },
  "/reports": { label: "Reports", icon: <FileText className="w-4 h-4" />, desc: "Generate executive risk reports" },
  "/notifications": { label: "Notifications", icon: <BellRing className="w-4 h-4" />, desc: "Alert feed and integrations" },
  "/data": { label: "Data & Audit", icon: <Database className="w-4 h-4" />, desc: "CSV import/export and audit trail" },
};

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const page = PAGES[pathname] ?? PAGES["/"];

  return (
    <div
      className="glass sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3 shrink-0"
      style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}
    >
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors mr-1"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg text-primary flex-shrink-0"
          style={{ background: "oklch(0.70 0.15 162 / 12%)", border: "1px solid oklch(0.70 0.15 162 / 20%)" }}
        >
          {page.icon}
        </div>
        <div>
          <h2 className="font-semibold text-sm text-foreground leading-tight">{page.label}</h2>
          <p className="text-[11px] text-muted-foreground hidden sm:block">{page.desc}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("crisp:command"))}
          className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          style={{ background: "oklch(0.205 0.004 286)", border: "1px solid oklch(1 0 0 / 8%)" }}
          aria-label="Open command palette"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <kbd className="text-[10px] border border-white/15 rounded px-1 ml-1">⌘K</kbd>
        </button>
        <NotificationBell />
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
          style={{ background: "oklch(0.70 0.15 162 / 8%)", border: "1px solid oklch(0.70 0.15 162 / 15%)" }}
        >
          <Shield className="w-3 h-3 text-primary" />
          <span className="text-xs font-medium text-primary">CRISP v2.0</span>
        </div>
      </div>
    </div>
  );
}
