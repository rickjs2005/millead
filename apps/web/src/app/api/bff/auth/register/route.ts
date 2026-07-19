import { NextResponse, type NextRequest } from "next/server";
import { applySession, INTERNAL_API_URL } from "@/lib/bff-server";

/** Registro: cria org+owner na API e troca os tokens da sessão por cookies httpOnly. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const apiRes = await fetch(`${INTERNAL_API_URL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await apiRes.json().catch(() => null);
  if (!apiRes.ok) {
    return NextResponse.json(data ?? { error: { code: "ERROR", message: "Erro ao registrar." } }, {
      status: apiRes.status,
    });
  }

  const { accessToken, refreshToken, ...safe } = data;
  const res = NextResponse.json(safe, { status: 200 });
  applySession(res, accessToken, refreshToken);
  return res;
}
