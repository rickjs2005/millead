"use client";

import { Bell, Check, Clock, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { describeAlert, formatVaultDate } from "@/features/vault/format";
import {
  useMarkAlertRead,
  useRefreshVaultAlerts,
  useSnoozeAlert,
  useVaultAlerts,
} from "@/features/vault/subscription-hooks";
import type { VaultAlertType } from "@/types/api";

/** Alertas que pedem ação mais rápida aparecem com destaque. */
const URGENTES: ReadonlySet<VaultAlertType> = new Set([
  "RENEWS_TODAY",
  "RENEWS_TOMORROW",
  "PRICE_CHANGED",
  "MISSING_CHARGE",
]);

/** Adiar por uma semana — prazo padrão do botão. */
function emUmaSemana(now = new Date()): string {
  const target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

export default function CofreAlertasPage() {
  const alerts = useVaultAlerts();
  const refresh = useRefreshVaultAlerts();
  const markRead = useMarkAlertRead();
  const snooze = useSnoozeAlert();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RefreshCw /> {refresh.isPending ? "Verificando…" : "Verificar agora"}
        </Button>
      </div>

      {alerts.isPending && <Skeleton className="h-40 w-full" />}

      {!alerts.isPending && (alerts.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Bell}
          title="Nada pedindo atenção"
          description="Renovações próximas, variações de preço e cobranças que não vieram aparecem aqui. A verificação roda sozinha toda vez que você abre o Cofre."
        />
      )}

      <ul className="space-y-2">
        {(alerts.data ?? []).map((alert) => (
          <li
            key={alert.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm">{describeAlert(alert.type, alert.payload)}</p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatVaultDate(alert.referenceDate)}</span>
                {URGENTES.has(alert.type) && (
                  <Badge variant="secondary" className="text-[10px]">
                    urgente
                  </Badge>
                )}
                {alert.status === "SNOOZED" && (
                  <Badge variant="outline" className="text-[10px]">
                    voltou de um adiamento
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => snooze.mutate({ id: alert.id, until: emUmaSemana() })}
                disabled={snooze.isPending}
              >
                <Clock /> Adiar 7 dias
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markRead.mutate(alert.id)}
                disabled={markRead.isPending}
              >
                <Check /> Ok
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Adiar tem prazo: o alerta volta sozinho quando a data chega. A notificação no navegador é a
        segunda camada — no plano gratuito o servidor dorme, então esta tela é a garantia.
      </p>
    </div>
  );
}
