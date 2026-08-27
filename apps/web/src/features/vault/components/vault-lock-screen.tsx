"use client";

import { KeyRound, Lock, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUnlockVault, useVaultStatus } from "@/features/vault/hooks";

/** "em 3 minutos", "em 45 segundos" -- o suficiente pra saber se vale esperar. */
function formatWait(until: Date, now: Date): string {
  const seconds = Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 1000));
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }
  return `${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
}

/**
 * Tela de reautenticação do Cofre.
 *
 * Regra que manda no visual: NADA de financeiro antes do desbloqueio. Sem
 * saldo, sem contagem de movimentações, sem "última importação" -- nem como
 * esqueleto de carregamento. Quem olha esta tela por cima do ombro não
 * aprende nada além de que existe um Cofre.
 */
export function VaultLockScreen() {
  const status = useVaultStatus();
  const unlock = useUnlockVault();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // useMemo porque `new Date(...)` cria um objeto novo a cada render, e este
  // valor é dependência de dois efeitos -- sem ele, o intervalo do contador
  // seria destruído e recriado a cada segundo.
  const lockedUntil = useMemo(
    () => (status.data?.lockedUntil ? new Date(status.data.lockedUntil) : null),
    [status.data?.lockedUntil],
  );
  const isLocked = lockedUntil !== null && lockedUntil.getTime() > now.getTime();

  // Só faz o relógio andar enquanto há contagem regressiva na tela.
  useEffect(() => {
    if (!isLocked) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isLocked]);

  // Quando o bloqueio vence, o contador some sozinho e o formulário volta --
  // sem precisar recarregar a página.
  const refetchStatus = status.refetch;
  useEffect(() => {
    if (lockedUntil && lockedUntil.getTime() <= now.getTime()) void refetchStatus();
  }, [lockedUntil, now, refetchStatus]);

  const attemptsLeft = status.data?.attemptsRemaining ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await unlock.mutateAsync(password);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir o Cofre.");
      setPassword("");
      void refetchStatus();
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center px-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-medium">Cofre Financeiro</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirme sua senha para abrir. O Cofre se fecha sozinho após 15 minutos parado.
        </p>
      </div>

      {isLocked ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">Bloqueado temporariamente</p>
            <p className="mt-1 text-muted-foreground">
              Tentativas demais. Tente de novo em {formatWait(lockedUntil, now)}.
            </p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vault-password">Senha da sua conta</Label>
            <Input
              id="vault-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error !== null}
              aria-describedby={error ? "vault-password-error" : undefined}
            />
          </div>

          {error && (
            <p id="vault-password-error" role="alert" className="text-sm text-destructive">
              {error}
              {attemptsLeft !== null && attemptsLeft > 0 && (
                <span className="text-muted-foreground">
                  {" "}
                  — {attemptsLeft}{" "}
                  {attemptsLeft === 1 ? "tentativa restante" : "tentativas restantes"}.
                </span>
              )}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={!password || unlock.isPending}>
            <KeyRound /> {unlock.isPending ? "Abrindo…" : "Abrir Cofre"}
          </Button>
        </form>
      )}
    </div>
  );
}
