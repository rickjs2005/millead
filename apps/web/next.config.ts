import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * CSP pragmática: fecha clickjacking (`frame-ancestors 'none'`), injeção de
 * `<base>`/plugins (`base-uri`/`object-src`) e restringe de onde o app
 * carrega/conecta. `script-src`/`style-src` ainda liberam `'unsafe-inline'`
 * porque o Next injeta scripts/estilos inline sem nonce no App Router --
 * endurecer pra nonce/hash é um passo seguinte (exige middleware que injete
 * o nonce). `connect-src` inclui a API e o Blob (uploads diretos do browser).
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${API_URL} https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
