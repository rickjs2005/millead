"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { VaultLockScreen } from "@/features/vault/components/vault-lock-screen";
import { VaultNav } from "@/features/vault/components/vault-nav";
import {
  isVaultLocked,
  isVaultMissing,
  useCreateVault,
  useLockVault,
  useVaultSession,
} from "@/features/vault/hooks";
import { useRefreshVaultAlerts } from "@/features/vault/subscription-hooks";

/**
 * Porta do Cofre, para todas as telas de dentro.
 *
 * A verificação de acesso mora aqui, e não em cada página, por dois motivos:
 * uma página nova nasce protegida sem ninguém lembrar de nada, e o conteúdo
 * do Cofre nunca chega a ser montado enquanto ele está fechado — não é uma
 * tela escondida por cima, é uma tela que não existe.
 *
 * Quem decide é o SERVIDOR (`GET /vault/session`). Recarregar não abre nada.
 */
export default function CofreLayout({ children }: { children: ReactNode }) {
  const session = useVaultSession();
  const createVault = useCreateVault();
  const lockVault = useLockVault();
  const refreshAlerts = useRefreshVaultAlerts();

  const aberto = !session.isPending && !session.isError;

  // Verificação de renovações ao abrir o Cofre. É o PRIMEIRO nível de entrega
  // dos alertas -- o push é a segunda camada, e no free tier o worker dorme.
  // `useRef` porque isto é um efeito colateral por abertura, não por render.
  const jaVerificou = useRef(false);
  useEffect(() => {
    if (!aberto || jaVerificou.current) return;
    jaVerificou.current = true;
    refreshAlerts.mutate();
  }, [aberto, refreshAlerts]);

  if (session.isPending) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3 py-24">
        <Skeleton className="mx-auto h-11 w-11 rounded-full" />
        <Skeleton className="mx-auto h-4 w-40" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  // Primeiro acesso: o Cofre não existe até você criar. É aqui que você vira o
  // dono dele — não há e-mail configurado em lugar nenhum decidindo isso.
  if (isVaultMissing(session.error)) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-medium">Criar seu Cofre Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Área privada para suas finanças pessoais. Fica fora da organização: ninguém da equipe vê,
          consulta ou soma esses dados — nem quem for administrador.
        </p>
        <Button
          className="mt-5"
          disabled={createVault.isPending}
          onClick={() => createVault.mutate()}
        >
          {createVault.isPending ? "Criando…" : "Criar Cofre"}
        </Button>
      </div>
    );
  }

  if (isVaultLocked(session.error)) return <VaultLockScreen />;

  if (session.isError) {
    return (
      <div className="mx-auto w-full max-w-sm py-24 text-center text-sm text-muted-foreground">
        Não foi possível verificar o Cofre agora. Tente novamente em instantes.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Cofre Financeiro</h1>
          <p className="text-xs text-muted-foreground">Fecha sozinho após 15 minutos sem uso.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => lockVault.mutate()}
          disabled={lockVault.isPending}
        >
          <Lock /> Bloquear agora
        </Button>
      </div>

      <VaultNav />
      {children}
    </div>
  );
}
