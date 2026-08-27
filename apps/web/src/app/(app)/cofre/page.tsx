"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { VaultLockScreen } from "@/features/vault/components/vault-lock-screen";
import {
  isVaultLocked,
  isVaultMissing,
  useCreateVault,
  useLockVault,
  useVaultSession,
} from "@/features/vault/hooks";

/**
 * Porta do Cofre Financeiro.
 *
 * Quem manda no que aparece é o SERVIDOR (`useVaultSession`), não um estado
 * local — recarregar a página não abre o Cofre, e um erro de renderização não
 * escancara conteúdo. A proteção de verdade está na API (`requireVault`);
 * esta tela só reflete a resposta dela.
 */
export default function CofrePage() {
  const session = useVaultSession();
  const createVault = useCreateVault();
  const lockVault = useLockVault();

  if (session.isPending) {
    return (
      <div className="mx-auto w-full max-w-sm space-y-3 py-24">
        <Skeleton className="h-11 w-11 rounded-full mx-auto" />
        <Skeleton className="h-4 w-40 mx-auto" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  // Primeiro acesso: o Cofre não existe até você criar. É o momento em que
  // você vira o dono dele -- não há e-mail configurado em lugar nenhum
  // decidindo isso.
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

  if (isVaultLocked(session.error)) {
    return <VaultLockScreen />;
  }

  if (session.isError) {
    return (
      <div className="mx-auto w-full max-w-sm py-24 text-center text-sm text-muted-foreground">
        Não foi possível verificar o Cofre agora. Tente novamente em instantes.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">Cofre Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Aberto. Fecha sozinho após 15 minutos sem uso.
          </p>
        </div>
        <Button variant="outline" onClick={() => lockVault.mutate()} disabled={lockVault.isPending}>
          <Lock /> Bloquear agora
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em construção</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          A segurança do Cofre está pronta: reautenticação, sessão própria de 15 minutos, bloqueio
          manual e no logout, e limite de tentativas. Contas, cartões, movimentações, importação de
          OFX/CSV e assinaturas entram nas próximas fases.
        </CardContent>
      </Card>
    </div>
  );
}
