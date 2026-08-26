import { NextResponse, type NextRequest } from "next/server";
import { applySession, INTERNAL_API_URL } from "@/lib/bff-server";

/** Aceite público: troca os tokens retornados pela API por cookies httpOnly. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();
  const apiRes = await fetch(`${INTERNAL_API_URL}/api/v1/public/team-invitations/accept`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  });
  const data = await apiRes.json().catch(() => null);
  if (!apiRes.ok) {
    return NextResponse.json(
      data ?? { error: { code: "ERROR", message: "Não foi possível aceitar o convite." } },
      { status: apiRes.status },
    );
  }

  const { accessToken, refreshToken, ...safe } = data;
  const response = NextResponse.json(safe, { status: 200 });
  applySession(response, accessToken, refreshToken);
  return response;
}
