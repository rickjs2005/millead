/**
 * Base pública do próprio front (usada pra montar links compartilháveis,
 * ex.: /b/:token do briefing). Em runtime no browser usa a origin real da
 * página -- funciona em produção (millead.milweb.com.br) e em dev sem
 * precisar configurar env na Vercel. NEXT_PUBLIC_APP_URL fica como override
 * explícito e fallback de SSR.
 *
 * VERCEL_PROJECT_PRODUCTION_URL entra antes do fallback localhost porque em
 * SSR (metadata, og:image) não existe `window`: sem ele, esquecer de setar
 * NEXT_PUBLIC_APP_URL na Vercel gera link/preview apontando pra localhost.
 * Essa env só existe no servidor -- no browser o ramo do `window` já retornou.
 */
export function publicAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}
