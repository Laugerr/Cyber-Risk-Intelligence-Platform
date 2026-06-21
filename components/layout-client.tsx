"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";
import { AskCrisp } from "@/components/ask-crisp";
import { CommandPalette } from "@/components/command-palette";

export function LayoutClient({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 min-h-screen overflow-y-auto flex flex-col">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} />
        <div key={pathname} className="p-4 sm:p-6 flex-1 animate-fade-up">
          {children}
        </div>
      </main>

      <AskCrisp />
      <CommandPalette />
    </>
  );
}
