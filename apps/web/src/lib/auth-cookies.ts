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
/** Sessão elevada do Cofre Financeiro. Cookie separado dos de sessão de
 *  propósito: expira sozinho, é apagado pelo "Bloquear agora" e some sem
 *  derrubar o login do resto do app. */
export const VAULT_COOKIE = "ml_vs";

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

/**
 * Cookie da sessão elevada do Cofre. Diferenças que importam em relação ao
 * `sessionCookieOptions`:
 *
 * - `maxAge` curto: o navegador descarta sozinho, então um dispositivo
 *   esquecido não guarda a chave do Cofre por 30 dias. É defesa em
 *   profundidade, não a trava principal -- quem decide de verdade é o `exp`
 *   do JWT e o corte de sessões no banco, que o navegador não controla.
 * - `sameSite: "strict"`: o Cofre não tem nenhum fluxo que venha de outro
 *   site (diferente do login, que precisa de "lax" pra sobreviver a
 *   redirects), então dá pra fechar mais.
 *
 * `maxAgeSeconds` vem da API (`expiresInSeconds`), pra o navegador e o
 * servidor não discordarem sobre quando a sessão acaba.
 */
export function vaultCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.max(0, maxAgeSeconds),
  };
}
