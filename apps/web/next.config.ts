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
  // `https://vercel.com` é obrigatório: o upload com clientToken do
  // @vercel/blob/client NÃO fala direto com o storage -- ele faz o PUT via
  // `https://vercel.com/api/blob/...`. Sem essa origem o CSP bloqueia o
  // upload do briefing silenciosamente (fetch recusado antes de sair).
  `connect-src 'self' ${API_URL} https://vercel.com https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com`,
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
  // Primeiro pacote de runtime do workspace consumido pelo web. O
  // @millead/video-contracts publica .ts cru (main: ./src/index.ts), então o
  // Next precisa transpilá-lo. É aditivo e afeta só o pacote nomeado.
  transpilePackages: ["@millead/video-contracts"],
  // O pacote usa resolução NodeNext (tsconfig do pacote): os imports internos
  // dele terminam em ".js" mas apontam para arquivos ".ts" (regra ESM do
  // TypeScript). Nem webpack (`next build`) nem Turbopack (`next dev
  // --turbopack`) resolvem ".js" -> ".ts" sozinhos -- sem isso, os dois
  // quebram com "Module not found" em cada import interno do pacote
  // (annotation.js, brief.js, etc.), cada um com a config equivalente abaixo.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  turbopack: {
    // Mesmo problema do webpack acima, mas o Turbopack não tem um
    // "extensionAlias" genérico -- só resolveAlias por especificador exato,
    // resolvido a partir da raiz do app (não do arquivo que importa). Por
    // isso a lista é hardcoded para os 5 imports internos do índice do
    // pacote, com caminho relativo a partir de apps/web.
    resolveAlias: {
      "./annotation.js": "../../packages/video-contracts/src/annotation.ts",
      "./brief.js": "../../packages/video-contracts/src/brief.ts",
      "./manifest.js": "../../packages/video-contracts/src/manifest.ts",
      "./project.js": "../../packages/video-contracts/src/project.ts",
      "./snapshot.js": "../../packages/video-contracts/src/snapshot.ts",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
