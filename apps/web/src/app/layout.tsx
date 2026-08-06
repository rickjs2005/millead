import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import { AppProviders } from "@/providers/app-providers";
import { publicAppUrl } from "@/lib/public-url";
import "./globals.css";

const DESCRIPTION =
  "CRM da MilWeb: pipeline de leads, propostas, contratos e briefings num lugar só.";

/**
 * `new URL()` lança em string malformada, e aqui isso rodaria no módulo do root
 * layout -- ou seja, uma env mal digitada (domínio sem `https://`) derrubaria o
 * BUILD INTEIRO, não só o og:image. Por isso nunca lança: completa o esquema
 * quando falta e, em último caso, cai em localhost avisando no log do build.
 */
function resolveMetadataBase(): URL {
  const raw = publicAppUrl();
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(candidate);
  } catch {
    console.warn(`[metadata] NEXT_PUBLIC_APP_URL inválida (${raw}); usando localhost.`);
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  // Base pra transformar as URLs relativas abaixo (ícones, og:image) em
  // absolutas -- exigido pelo og:image, que crawlers/WhatsApp não resolvem
  // relativo. Sem isso o Next avisa no build e cai em localhost.
  metadataBase: resolveMetadataBase(),
  title: "MilLead",
  description: DESCRIPTION,
  applicationName: "MilLead",
  appleWebApp: { capable: true, title: "MilLead", statusBarStyle: "black-translucent" },
  // Os PNGs já existiam em public/, mas arquivo em public/ não vira <link>
  // sozinho -- só as convenções de arquivo dentro de app/ fazem isso. Sem
  // declarar aqui, o HTML saía sem favicon e sem apple-touch-icon (aba do
  // browser e "adicionar à tela de início" no iOS ficavam com ícone genérico).
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: { url: "/apple-icon.png", type: "image/png", sizes: "180x180" },
  },
  // Vale principalmente pras páginas públicas que o cliente recebe por
  // WhatsApp (/p/:token da proposta e /b/:token do briefing): elas herdam
  // esse bloco, então o link chega com card em vez de URL crua. O og:image
  // vem do app/opengraph-image.tsx (convenção de arquivo do Next).
  openGraph: {
    type: "website",
    siteName: "MilLead",
    locale: "pt_BR",
    title: "MilLead",
    description: DESCRIPTION,
  },
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
