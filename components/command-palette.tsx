"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard, Server, Boxes, Bug, Crosshair, Grid3x3, LineChart, Timer,
  ShieldCheck, TrendingUp, Bell, FileText, Database, Search, CornerDownLeft,
  FlaskConical, RefreshCw, Wand2, History, Sparkles, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  group: "Navigation" | "Actions";
  run: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => { setOpen(false); setQuery(""); setActive(0); }, []);

  const go = useCallback((href: string) => { close(); router.push(href); }, [close, router]);

  const action = useCallback((label: string, fn: () => Promise<unknown>) => {
    close();
    const t = toast.loading(`${label}…`);
    fn()
      .then(() => toast.success(`${label} complete`, { id: t }))
      .catch((e) => toast.error(`${label} failed: ${e}`, { id: t }));
  }, [close]);

  const commands = useMemo<Command[]>(() => {
    const nav: [string, string, React.ReactNode][] = [
      ["/", "Dashboard", <LayoutDashboard key="i" className="w-4 h-4" />],
      ["/assets", "Assets", <Server key="i" className="w-4 h-4" />],
      ["/inventory", "Software Inventory", <Boxes key="i" className="w-4 h-4" />],
      ["/vulnerabilities", "Vulnerabilities", <Bug key="i" className="w-4 h-4" />],
      ["/prioritize", "Smart Prioritization", <Crosshair key="i" className="w-4 h-4" />],
      ["/heatmap", "Risk Heatmap", <Grid3x3 key="i" className="w-4 h-4" />],
      ["/trends", "Risk Trends", <LineChart key="i" className="w-4 h-4" />],
      ["/sla", "SLA & Remediation", <Timer key="i" className="w-4 h-4" />],
      ["/compliance", "Compliance", <ShieldCheck key="i" className="w-4 h-4" />],
      ["/risk", "Risk & ROSI", <TrendingUp key="i" className="w-4 h-4" />],
      ["/notifications", "Notifications", <Bell key="i" className="w-4 h-4" />],
      ["/reports", "Reports", <FileText key="i" className="w-4 h-4" />],
      ["/data", "Data & Audit", <Database key="i" className="w-4 h-4" />],
    ];
    const navCmds: Command[] = nav.map(([href, label, icon]) => ({
      id: `nav:${href}`, label, hint: "Go to page", icon, group: "Navigation", run: () => go(href),
    }));

    const post = (url: string) => fetch(url, { method: "POST" }).then((r) => r.json()).then((d) => { if (d.error) throw new Error(d.error); return d; });

    const actionCmds: Command[] = [
      { id: "a:seed", label: "Load Demo Data", hint: "Seed assets, CVEs & software", icon: <FlaskConical className="w-4 h-4" />, group: "Actions", run: () => action("Loading demo data", () => post("/api/seed")) },
      { id: "a:sync", label: "Sync Threat Intel", hint: "Pull CISA KEV + FIRST EPSS", icon: <RefreshCw className="w-4 h-4" />, group: "Actions", run: () => action("Syncing threat intel", () => Promise.all([post("/api/sync/kev"), post("/api/sync/epss")])) },
      { id: "a:match", label: "Run CVE Auto-Match", hint: "Link advisories to software", icon: <Wand2 className="w-4 h-4" />, group: "Actions", run: () => action("Auto-matching CVEs", () => post("/api/inventory/match")) },
      { id: "a:scan", label: "Scan for Notifications", hint: "KEV / critical / SLA events", icon: <Bell className="w-4 h-4" />, group: "Actions", run: () => action("Scanning", () => post("/api/notifications/scan")) },
      { id: "a:history", label: "Generate Trend History", hint: "30-day snapshot backfill", icon: <History className="w-4 h-4" />, group: "Actions", run: () => action("Generating history", () => post("/api/snapshot")) },
      { id: "a:ai", label: "Ask CRISP (AI Analyst)", hint: "Open the AI assistant", icon: <Sparkles className="w-4 h-4" />, group: "Actions", run: () => { close(); window.dispatchEvent(new CustomEvent("crisp:ask")); } },
    ];
    return [...navCmds, ...actionCmds];
  }, [go, action, close]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.hint?.toLowerCase().includes(q));
  }, [commands, query]);

  // Global open shortcut + custom event
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function onOpen() { setOpen(true); }
    window.addEventListener("keydown", onKey);
    window.addEventListener("crisp:command", onOpen);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("crisp:command", onOpen); };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20); }, [open]);
  useEffect(() => { setActive(0); }, [query]);

  // In-palette keyboard navigation
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[active]?.run(); }
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 animate-fade" onMouseDown={close}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl animate-scale-in glass"
        style={{ border: "1px solid oklch(1 0 0 / 12%)" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: "1px solid oklch(1 0 0 / 8%)" }}>
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border border-white/15 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No matches for “{query}”.</p>
          ) : (
            filtered.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <div key={c.id}>
                  {header && <p className="text-[10px] uppercase tracking-widest text-muted-foreground px-4 pt-3 pb-1">{header}</p>}
                  <button
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => c.run()}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                    style={{ background: i === active ? "oklch(0.70 0.15 162 / 12%)" : "transparent" }}
                  >
                    <span className={i === active ? "text-primary" : "text-muted-foreground"}>{c.icon}</span>
                    <span className="flex-1 text-sm">{c.label}</span>
                    {c.hint && <span className="text-[11px] text-muted-foreground hidden sm:block">{c.hint}</span>}
                    {i === active ? <CornerDownLeft className="w-3.5 h-3.5 text-primary" /> : <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 text-[10px] text-muted-foreground" style={{ borderTop: "1px solid oklch(1 0 0 / 8%)" }}>
          <span className="flex items-center gap-1"><kbd className="border border-white/15 rounded px-1">↑</kbd><kbd className="border border-white/15 rounded px-1">↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="border border-white/15 rounded px-1">↵</kbd> select</span>
          <span className="ml-auto">CRISP Command</span>
        </div>
      </div>
    </div>
  );
}
