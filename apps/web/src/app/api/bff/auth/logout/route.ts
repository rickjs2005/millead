import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";
import { clearSession, INTERNAL_API_URL } from "@/lib/bff-server";

/**
 * Logout: revoga o refresh token no servidor (fonte de verdade da sessão) e
 * apaga os cookies. Idempotente -- sem cookie, só limpa e responde 204.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${INTERNAL_API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    }).catch(() => undefined);
  }

  const res = new NextResponse(null, { status: 204 });
  clearSession(res);
  return res;
}
