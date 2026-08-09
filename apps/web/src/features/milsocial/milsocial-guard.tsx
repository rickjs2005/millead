"use client";

import { notFound } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Guard do MilSocial: so o dono (NEXT_PUBLIC_OWNER_EMAIL) ve a rota; qualquer
 * outro usuario cai em notFound() -- mesma semantica do 404 da API. Vive num
 * arquivo proprio (fora de layout.tsx) porque o Next so aceita um conjunto
 * fixo de exports nomeados em arquivos de layout/page -- exportar um
 * componente extra ali quebra a checagem de tipos de rotas.
 * A rota renderiza DENTRO do ProtectedShell (sidebar/topbar do CRM): o item
 * MilSocial da sidebar e ownerOnly, entao a navegacao continua invisivel pros
 * outros usuarios -- sem shell a pagina virava beco sem saida (sem volta). A
 * protecao real e a da API (requireOwner); aqui e so pra nao renderizar a UI.
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

  // padding vem do <main> do AppShell; p-6 aqui dobrava o respiro
  return <div className="mx-auto max-w-6xl">{children}</div>;
}
