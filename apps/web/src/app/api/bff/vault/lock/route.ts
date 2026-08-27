import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, VAULT_COOKIE, vaultCookieOptions } from "@/lib/auth-cookies";
import { INTERNAL_API_URL } from "@/lib/bff-server";

/**
 * "Bloquear agora". Faz as duas metades: manda a API cortar as sessões
 * elevadas no servidor E apaga o cookie. Só apagar o cookie seria teatro --
 * o token já emitido continuaria válido pra quem tivesse cópia dele.
 *
 * O cookie é apagado mesmo se a chamada à API falhar: fechar o Cofre é o tipo
 * de ação que não pode depender da rede pra ao menos parecer feita na tela.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;

  if (accessToken) {
    await fetch(`${INTERNAL_API_URL}/api/v1/vault/lock`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }).catch(() => undefined);
  }

  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(VAULT_COOKIE, "", vaultCookieOptions(0));
  return res;
}
