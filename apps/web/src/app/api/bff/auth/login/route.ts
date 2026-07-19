import { NextResponse, type NextRequest } from "next/server";
import { applySession, INTERNAL_API_URL } from "@/lib/bff-server";

/**
 * Login: repassa credenciais pra API, e ao receber a sessão TROCA os tokens
 * por cookies httpOnly -- o browser recebe só `{ user, organization, role }`,
 * nunca os tokens. Se a API pedir escolha de organização, repassa como está
 * (ainda sem sessão emitida).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const apiRes = await fetch(`${INTERNAL_API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await apiRes.json().catch(() => null);
  if (!apiRes.ok) {
    return NextResponse.json(data ?? { error: { code: "ERROR", message: "Erro ao entrar." } }, {
      status: apiRes.status,
    });
  }
  if (data && "requiresOrganizationSelection" in data) {
    return NextResponse.json(data, { status: 200 });
  }

  const { accessToken, refreshToken, ...safe } = data;
  const res = NextResponse.json(safe, { status: 200 });
  applySession(res, accessToken, refreshToken);
  return res;
}
