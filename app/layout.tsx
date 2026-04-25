import type { Metadata } from "next";
import { Ubuntu, Ubuntu_Mono } from "next/font/google";
import "./globals.css";
import { LayoutClient } from "@/components/layout-client";
import { Toaster } from "@/components/ui/sonner";

const ubuntu = Ubuntu({
  variable: "--font-ubuntu",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
});
const ubuntuMono = Ubuntu_Mono({
  variable: "--font-ubuntu-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "CRISP — Cyber Risk Intelligence Platform",
  description: "Enterprise cyber risk intelligence, asset management, and vulnerability tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${ubuntu.variable} ${ubuntuMono.variable}`}>
      <body className="flex min-h-screen bg-background text-foreground antialiased">
        <LayoutClient>{children}</LayoutClient>
        <Toaster position="bottom-right" theme="dark" richColors />
      </body>
    </html>
  );
}
