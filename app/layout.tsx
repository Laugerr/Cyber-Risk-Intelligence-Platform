import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CRISP — Cyber Risk Intelligence Platform",
  description: "Enterprise cyber risk intelligence, asset management, and vulnerability tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen bg-background text-foreground antialiased">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 min-h-screen overflow-y-auto">
          {children}
        </main>
        <Toaster position="bottom-right" theme="dark" richColors />
      </body>
    </html>
  );
}
