import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import { applySession, clearSession, INTERNAL_API_URL } from "@/lib/bff-server";

/**
 * Renova a sessão a partir do refresh token em cookie. Chamado pelo api-client
 * (single-flight) quando uma request proxy leva 401. Em sucesso, grava o novo
 * par de tokens (a API rotaciona o refresh a cada uso); em falha, limpa os
 * cookies -- a sessão acabou.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const res = NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Sessão expirada." } },
      { status: 401 },
    );
    clearSession(res);
    return res;
  }

  const apiRes = await fetch(`${INTERNAL_API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });

  const data = await apiRes.json().catch(() => null);
  if (!apiRes.ok || !data) {
    const res = NextResponse.json(
      data ?? { error: { code: "UNAUTHORIZED", message: "Sessão expirada." } },
      { status: 401 },
    );
    clearSession(res);
    return res;
  }

  const { accessToken, refreshToken: newRefreshToken, ...safe } = data;
  const res = NextResponse.json(safe, { status: 200 });
  applySession(res, accessToken, newRefreshToken);
  return res;
}
