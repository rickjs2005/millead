"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/stores/auth-store";
import { AppShell } from "./app-shell";

/**
 * O middleware já garante (server-side) que só chega aqui quem tem cookie de
 * sessão. Este shell re-hidrata user/org/role de `/auth/me` (fonte de verdade,
 * autenticada por cookie via BFF) -- a store não persiste mais nada. Se o
 * `/me` falhar (refresh token expirado/revogado), o api-client já redireciona
 * pro /login; o efeito abaixo cobre o caso de o erro chegar aqui primeiro.
 */
export function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const { data, isError } = useMe(true);

  useEffect(() => {
    if (data) setSession(data);
  }, [data, setSession]);

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (!user) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="animate-pulse">
          <Logo />
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
