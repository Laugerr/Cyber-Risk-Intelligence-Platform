"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, Check, AlertTriangle, Clock, Zap } from "lucide-react";
import type { Notification, NotificationType } from "@/lib/types";

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  kev: <Zap className="w-3.5 h-3.5 text-red-400" />,
  critical: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
  sla_breach: <Clock className="w-3.5 h-3.5 text-orange-400" />,
  info: <Bell className="w-3.5 h-3.5 text-blue-400" />,
};

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetch("/api/notifications").then((r) => r.json());
      setItems(Array.isArray(data.items) ? data.items : []);
      setUnread(data.unread ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function markAll() {
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: "oklch(0.175 0.004 286)", border: "1px solid oklch(1 0 0 / 10%)" }}
        >
          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}>
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={markAll} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-6 h-6 mx-auto mb-2 text-muted-foreground opacity-20" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              items.slice(0, 12).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-white/[0.02]"
                  style={{ borderBottom: "1px solid oklch(1 0 0 / 4%)", background: n.read ? undefined : "oklch(0.70 0.15 162 / 5%)" }}
                >
                  <span className="mt-0.5 flex-shrink-0">{TYPE_ICON[n.type]}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-snug">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block text-center text-xs text-primary py-2.5 hover:bg-white/[0.02]"
            style={{ borderTop: "1px solid oklch(1 0 0 / 6%)" }}
          >
            View all &amp; settings
          </Link>
        </div>
      )}
    </div>
  );
}
