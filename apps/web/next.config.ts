import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// O @millead/video-contracts usa resolução NodeNext (tsconfig do pacote):
// os imports internos dele terminam em ".js" mas apontam para arquivos ".ts"
// (regra ESM do TypeScript). Nem webpack (`next build`) nem Turbopack
// (`next dev --turbopack`) resolvem ".js" -> ".ts" sozinhos -- sem a config
// abaixo, os dois quebram com "Module not found" em cada import interno do
// pacote (annotation.js, brief.js, etc.).
//
// O Turbopack não tem um "extensionAlias" genérico -- só resolveAlias por
// especificador exato. Em vez de manter a lista à mão (um export novo no
// pacote quebraria o `next dev` silenciosamente sem ninguém perceber), ela é
// derivada dos arquivos que existem de fato em packages/video-contracts/src.
// `process.cwd()` é apps/web quando o Next roda (dev ou build); se o caminho
// estiver errado isso falha alto no start (readdirSync lança), que é o
// comportamento desejado -- preferível a silenciosamente resolver errado.
//
// `index.ts` fica de fora de propósito: além de já resolver certo sozinho
// (via "exports"/"main" do package.json + transpilePackages), incluí-lo
// causou uma quebra real -- o zod (v3/ZodError.ts) tem um `import type ...
// from "./index.js"` interno, e como resolveAlias vale pro app inteiro (não
// só pro pacote), a entrada "./index.js" sequestrava esse import do zod e
// apontava pro index.ts do video-contracts, quebrando o zod em qualquer
// bundle que passasse pelos dois (ex.: o middleware, que virou "z" undefined
// em brief.ts). Achado no round 1 de revisão desta task.
const CONTRACTS_SRC_REL = "../../packages/video-contracts/src";

const contractsResolveAlias = Object.fromEntries(
  readdirSync(join(process.cwd(), CONTRACTS_SRC_REL))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts") && file !== "index.ts")
    .map((file) => [`./${file.replace(/\.ts$/, ".js")}`, `${CONTRACTS_SRC_REL}/${file}`]),
);

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
  // O PDF embutido da proposta pública (/p/[token]) vem de um <iframe> apontando
  // pro Vercel Blob -- sem frame-src liberando essa origem, default-src 'self'
  // bloqueia o embed silenciosamente (PDF em branco em produção).
  "frame-src 'self' https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com",
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
  // Next precisa transpilá-lo. `transpilePackages` é escopado por nome de
  // pacote -- só afeta o @millead/video-contracts.
  transpilePackages: ["@millead/video-contracts"],
  // ATENÇÃO: diferente do transpilePackages acima, os dois ganchos abaixo
  // (webpack.resolve.extensionAlias e turbopack.resolveAlias) NÃO são
  // escopados por pacote -- valem para todo o grafo de módulos do app.
  // - extensionAlias reescreve QUALQUER import ".js" -> tenta ".ts"/".tsx"
  //   primeiro, em qualquer arquivo de apps/web, não só dentro do pacote.
  // - resolveAlias intercepta o especificador exato (ex.: "./brief.js") em
  //   QUALQUER arquivo do app que o escrever, não só no index.ts do pacote.
  // Hoje isso é seguro porque nenhum arquivo de apps/web/src importa com
  // sufixo ".js" literal (o tsconfig do web usa moduleResolution "Bundler",
  // não "NodeNext" -- só o pacote video-contracts usa esse estilo de
  // import). Se algum dia isso deixar de ser verdade, os aliases abaixo
  // passam a interceptar imports que não têm nada a ver com o pacote.
  webpack(config) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
  turbopack: {
    resolveAlias: contractsResolveAlias,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Ícones de public/ não têm hash no nome (ao contrário de /_next/static),
      // então saem com `max-age=0, must-revalidate` e são revalidados a cada
      // carregamento. Um dia de cache + uma semana de stale-while-revalidate dá
      // o ganho sem prender uma versão antiga por um ano se o ícone mudar.
      {
        source: "/:icon(icon-192.png|icon-512.png|apple-icon.png)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
    ];
  },
};

export default nextConfig;
