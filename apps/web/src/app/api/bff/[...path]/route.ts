import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";
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
    if (!HOP_BY_HOP.has(key.toLowerCase())) resHeaders.set(key, value);
  });

  return new NextResponse(apiRes.body, { status: apiRes.status, headers: resHeaders });
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
