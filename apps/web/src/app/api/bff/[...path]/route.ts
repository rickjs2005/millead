import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, VAULT_COOKIE, vaultCookieOptions } from "@/lib/auth-cookies";
import { INTERNAL_API_URL } from "@/lib/bff-server";

/**
 * Proxy genérico do BFF: browser -> Next (mesma origem, com cookie) -> API
 * Express (com Bearer). O access token fica em cookie httpOnly, então é aqui,
 * no servidor, que ele é anexado como `Authorization` -- o JS do browser
 * nunca vê o token.
 *
 * NÃO faz refresh: um 401 é repassado como está. Quem trata o 401 é o
 * api-client no browser, com single-flight pra `/api/bff/auth/refresh` (um
 * único refresh por vez), preservando a rotação atômica anti-reuso do
 * backend -- se cada request 401 tentasse renovar sozinho, chamadas
 * concorrentes com o mesmo refresh token seriam vistas como roubo de sessão
 * e derrubariam a família inteira.
 *
 * Faz stream do corpo (`apiRes.body`) em vez de `.text()` pra não corromper
 * binários (ex.: PDF de contrato).
 */

// Headers hop-by-hop: o fetch já descomprimiu/rechunkou, então repassá-los
// quebraria o cliente.
const HOP_BY_HOP = new Set([
  "content-encoding",
  "content-length",
  "transfer-encoding",
  "connection",
]);

/** Sessão elevada do Cofre: cookie httpOnly -> header, só de servidor pra
 *  servidor. O JS do browser não monta nem lê nenhum dos dois. */
const VAULT_HEADER = "x-vault-session";
/** A API devolve a sessão renovada a cada request autorizada do Cofre. É o
 *  que faz os 15 minutos serem de INATIVIDADE. Vira cookie aqui e NÃO é
 *  repassado ao navegador -- se fosse, o token estaria de volta ao alcance
 *  do JS, que é exatamente o que o cookie httpOnly evita. */
const VAULT_RENEW_HEADER = "x-vault-session-renew";

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await ctx.params;
  const target = `${INTERNAL_API_URL}/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const accept = req.headers.get("accept");
  if (accept) headers.set("accept", accept);
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) headers.set("authorization", `Bearer ${token}`);
  const vaultToken = req.cookies.get(VAULT_COOKIE)?.value;
  if (vaultToken) headers.set(VAULT_HEADER, vaultToken);

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const apiRes = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: "manual",
    cache: "no-store",
  });

  const resHeaders = new Headers();
  apiRes.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === VAULT_RENEW_HEADER) return;
    resHeaders.set(key, value);
  });

  const res = new NextResponse(apiRes.body, { status: apiRes.status, headers: resHeaders });

  const renewed = apiRes.headers.get(VAULT_RENEW_HEADER);
  if (renewed) {
    // Mesma janela do TTL da API (15min). O servidor continua sendo a fonte
    // de verdade -- o cookie só evita que o navegador guarde a sessão do
    // Cofre por mais tempo que ela vale.
    res.cookies.set(VAULT_COOKIE, renewed, vaultCookieOptions(15 * 60));
  }

  return res;
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
