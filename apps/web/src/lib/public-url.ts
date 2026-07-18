/**
 * Base pública do próprio front (usada pra montar links compartilháveis,
 * ex.: /b/:token do briefing). Em runtime no browser usa a origin real da
 * página -- funciona em produção (millead.milweb.com.br) e em dev sem
 * precisar configurar env na Vercel. NEXT_PUBLIC_APP_URL fica como override
 * explícito e fallback de SSR.
 */
export function publicAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}
