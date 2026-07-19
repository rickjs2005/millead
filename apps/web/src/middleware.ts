import { NextResponse, type NextRequest } from "next/server";
import { REFRESH_COOKIE } from "@/lib/auth-cookies";

/**
 * Proteção de rota SERVER-SIDE. Antes, a única guarda era client-side (o
 * dashboard inteiro era servido pra qualquer visitante e só um useEffect
 * redirecionava) -- clickjacking e vazamento de estrutura. Aqui o gate roda
 * no servidor, antes de qualquer HTML sair.
 *
 * Checa só a PRESENÇA do cookie de refresh (a validade real é verificada pela
 * API a cada request proxy; validar o JWT aqui exigiria compartilhar o
 * segredo com o tier web, acoplamento que queremos evitar).
 */
const APP_PREFIXES = [
  "/dashboard",
  "/leads",
  "/companies",
  "/crm",
  "/agenda",
  "/meetings",
  "/tasks",
  "/proposals",
  "/contracts",
  "/messages",
  "/landing-pages",
  "/briefings",
  "/audit",
  "/settings",
];

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const hasSession = req.cookies.has(REFRESH_COOKIE);

  // Raiz: decide o destino pela sessão (substitui o redirect client-side).
  if (pathname === "/") {
    return NextResponse.redirect(new URL(hasSession ? "/dashboard" : "/login", req.url));
  }

  // Já logado não deve ver login/registro.
  if (hasSession && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Rotas do app exigem sessão.
  const isAppRoute = APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isAppRoute && !hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Exclui `/api` (os route handlers do BFF não podem ser gated -- login
  // precisa funcionar sem sessão), assets do Next e qualquer arquivo com
  // extensão (sw.js, manifest.webmanifest, ícones, etc.).
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
