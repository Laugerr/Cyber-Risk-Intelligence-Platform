"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Shield, LayoutDashboard, Server, Bug, TrendingUp, FileText, Activity, X } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/assets", label: "Assets", icon: Server },
  { href: "/vulnerabilities", label: "Vulnerabilities", icon: Bug },
  { href: "/risk", label: "Risk & ROSI", icon: TrendingUp },
  { href: "/reports", label: "Reports", icon: FileText },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen w-64 flex flex-col z-50 transition-transform duration-200",
        // Desktop: always visible
        "lg:translate-x-0",
        // Mobile: slide in/out
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}
      style={{ background: "oklch(0.08 0.04 328)", borderRight: "1px solid oklch(1 0 0 / 7%)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}>
        <div className="flex items-center gap-3">
          <div
            className="relative flex items-center justify-center w-8 h-8 rounded-xl flex-shrink-0"
            style={{ background: "oklch(0.62 0.20 32 / 15%)", border: "1px solid oklch(0.62 0.20 32 / 30%)" }}
          >
            <Shield className="w-4 h-4 text-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <p className="font-bold text-sm tracking-wide text-foreground">CRISP</p>
            <p className="text-[10px] tracking-widest uppercase" style={{ color: "oklch(0.62 0.20 32)" }}>
              Cyber Risk Intel
            </p>
          </div>
        </div>
        {/* Close button — mobile only */}
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Section label */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">Navigation</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              style={
                active
                  ? { background: "oklch(0.62 0.20 32 / 12%)", border: "1px solid oklch(0.62 0.20 32 / 25%)" }
                  : { border: "1px solid transparent" }
              }
            >
              <div
                className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-md transition-all flex-shrink-0",
                  active ? "bg-primary/15" : "bg-transparent group-hover:bg-secondary"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              {label}
              {active && <div className="ml-auto w-1 h-4 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div
        className="mx-3 mb-4 px-4 py-3 rounded-xl"
        style={{ background: "oklch(0.62 0.20 32 / 8%)", border: "1px solid oklch(0.62 0.20 32 / 20%)" }}
      >
        <div className="flex items-center gap-2 mb-0.5">
          <Activity className="w-3 h-3 text-primary" />
          <span className="text-xs font-medium text-primary">System Online</span>
        </div>
        <p className="text-[10px] text-muted-foreground">Supabase · Vercel · v2.0</p>
      </div>
    </aside>
  );
}
