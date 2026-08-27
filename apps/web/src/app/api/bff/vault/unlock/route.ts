import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, VAULT_COOKIE, vaultCookieOptions } from "@/lib/auth-cookies";
import { INTERNAL_API_URL } from "@/lib/bff-server";

/**
 * Desbloqueio do Cofre. Existe como rota própria (em vez de passar pelo proxy
 * genérico) pelo mesmo motivo do login: a API devolve a sessão elevada no
 * CORPO, e é aqui, no servidor, que ela vira cookie httpOnly. O JS do
 * navegador nunca vê o token -- um XSS não consegue exfiltrar a chave do
 * Cofre, só usá-la enquanto a aba estiver aberta.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sessão expirada." } },
      { status: 401 },
    );
  }

  const apiRes = await fetch(`${INTERNAL_API_URL}/api/v1/vault/unlock`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
    body: await req.text(),
    cache: "no-store",
  });

  const data = (await apiRes.json().catch(() => null)) as {
    token?: string;
    expiresInSeconds?: number;
  } | null;

  if (!apiRes.ok || !data?.token) {
    // Repassa o erro da API como veio (401 de senha errada, 404 de "não
    // existe Cofre") -- sem inventar mensagem própria, que poderia
    // acidentalmente distinguir os dois casos.
    return NextResponse.json(
      data ?? { error: { code: "ERROR", message: "Não foi possível abrir o Cofre." } },
      { status: apiRes.status },
    );
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(VAULT_COOKIE, data.token, vaultCookieOptions(data.expiresInSeconds ?? 900));
  return res;
}
