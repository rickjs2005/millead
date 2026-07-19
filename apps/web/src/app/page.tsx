import { Logo } from "@/components/logo";

/**
 * O `middleware.ts` intercepta `/` e redireciona pra /dashboard ou /login
 * conforme o cookie de sessão, então esta página quase nunca renderiza -- é só
 * um loader de fallback (ex.: se o middleware for pulado por algum motivo).
 */
export default function RootPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}
