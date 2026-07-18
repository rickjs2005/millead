import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/providers/app-providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MilLead",
  description: "CRM e prospecção de leads para a MilWeb.",
  applicationName: "MilLead",
  appleWebApp: { capable: true, title: "MilLead", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#12a3e0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
