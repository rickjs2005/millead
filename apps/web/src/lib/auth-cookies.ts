/**
 * Nomes e opções dos cookies de sessão do BFF. Módulo puro (sem deps de
 * `next/headers`/`next/server`) de propósito -- é importado tanto pelos route
 * handlers quanto pelo `middleware.ts` (edge runtime), que não podem carregar
 * APIs só-de-servidor.
 *
 * Os tokens vivem em cookies httpOnly (inacessíveis ao JS do browser), então
 * um XSS não consegue mais exfiltrar a sessão -- diferente do localStorage
 * que a versão anterior usava.
 */
export const ACCESS_COOKIE = "ml_at";
export const REFRESH_COOKIE = "ml_rt";

// O access token é um JWT que expira sozinho em 15min (a API rejeita expirado
// e o fluxo de refresh renova). O cookie pode durar mais -- quem manda na
// validade real é o refresh token (30d), espelhando o TTL do backend.
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    // Em dev (http://localhost) `secure` impediria o cookie de ser setado.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  };
}
