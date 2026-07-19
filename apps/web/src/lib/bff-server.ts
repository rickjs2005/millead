import type { NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, sessionCookieOptions } from "./auth-cookies";

/**
 * URL da API Express vista PELO SERVIDOR Next (server-to-server). Separada de
 * `NEXT_PUBLIC_API_URL` (que vaza pro browser) pra permitir, no futuro, uma
 * URL interna/privada -- por ora cai no público como fallback de dev.
 */
export const INTERNAL_API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Grava os dois cookies httpOnly de sessão na resposta. */
export function applySession(res: NextResponse, accessToken: string, refreshToken: string): void {
  const opts = sessionCookieOptions();
  res.cookies.set(ACCESS_COOKIE, accessToken, opts);
  res.cookies.set(REFRESH_COOKIE, refreshToken, opts);
}

/** Expira os dois cookies (logout / refresh inválido). */
export function clearSession(res: NextResponse): void {
  const expired = { ...sessionCookieOptions(), maxAge: 0 };
  res.cookies.set(ACCESS_COOKIE, "", expired);
  res.cookies.set(REFRESH_COOKIE, "", expired);
}
