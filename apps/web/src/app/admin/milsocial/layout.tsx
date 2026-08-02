"use client";

import { notFound } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Guard do MilSocial: so o dono (NEXT_PUBLIC_OWNER_EMAIL) ve a rota; qualquer
 * outro usuario cai em notFound() -- mesma semantica do 404 da API. Layout
 * proprio SEM AppShell/sidebar do CRM de proposito: a ferramenta e pessoal e
 * nao deve aparecer na navegacao de ninguem. A protecao real e a da API
 * (requireOwner); aqui e so pra nao renderizar a UI.
 */
export function MilsocialGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const { data, isError } = useMe(true);

  useEffect(() => {
    if (data) setSession(data);
  }, [data, setSession]);

  if (isError) notFound();
  if (!user) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const owner = process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || user.email.trim().toLowerCase() !== owner) notFound();

  return <div className="mx-auto max-w-6xl p-6">{children}</div>;
}

export default function MilsocialLayout({ children }: { children: ReactNode }) {
  return <MilsocialGuard>{children}</MilsocialGuard>;
}
