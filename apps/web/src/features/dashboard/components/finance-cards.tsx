"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, FileSignature, HandCoins, Receipt, Scale, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { contractsService } from "@/services/contracts";
import { costsService } from "@/services/costs";
import { receivablesService } from "@/services/receivables";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/utils/format";

/**
 * Duas linhas: "Este mês" (granularidade do mês corrente) e "Ano" (totais do
 * ano civil corrente). Todo dado aqui vive atrás da mesma permissão
 * (`proposals:read` -- contratos, recebíveis e custos são a mesma área
 * financeira), então o componente inteiro some ou aparece junto.
 *
 * As queries de série (`receivables.series(12)` e `costs.usageSeries(12)`)
 * usam a MESMA queryKey que RevenueCostChart -- React Query dedupa por key,
 * então os dois componentes no dashboard não duplicam a chamada.
 */
export function FinanceCards() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission("proposals:read");

  const kpis = useQuery({
    queryKey: queryKeys.contracts.kpis(),
    queryFn: contractsService.kpis,
    enabled: canView,
  });
  const summary = useQuery({
    queryKey: queryKeys.receivables.summary(),
    queryFn: () => receivablesService.summary(),
    enabled: canView,
  });
  const series = useQuery({
    queryKey: queryKeys.receivables.series(12),
    queryFn: () => receivablesService.series(12),
    enabled: canView,
  });
  const costSummary = useQuery({
    queryKey: queryKeys.costs.summary(),
    queryFn: costsService.summary,
    enabled: canView,
  });
  const usageSeries = useQuery({
    queryKey: queryKeys.costs.usageSeries(12),
    queryFn: () => costsService.usageSeries(12),
    enabled: canView,
  });

  if (!canView) return null;

  const toReceive = Number(summary.data?.toReceive ?? 0);
  const overdue = Number(summary.data?.overdue ?? 0);
  const overdueCount = summary.data?.overdueItems.length ?? 0;
  const receivedMonth = Number(summary.data?.received ?? 0);

  const recebidoAno = Number(series.data?.yearTotals.received ?? 0);
  const consumoAno = usageSeries.data?.yearTotal ?? 0;
  const recurringMonthlyBrl = usageSeries.data?.recurringMonthlyBrl ?? 0;
  // Janeiro = 1 ... mês corrente incluso.
  const monthsElapsed = new Date().getMonth() + 1;
  const loadingResultado = series.isLoading || usageSeries.isLoading;
  const resultadoAno = recebidoAno - (consumoAno + recurringMonthlyBrl * monthsElapsed);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Este mês
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={`A receber${overdueCount > 0 ? ` (${overdueCount} vencidas)` : ""}`}
            value={formatCurrency(toReceive + overdue)}
            icon={Receipt}
            loading={summary.isLoading}
            accent={overdue > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Recebido"
            value={formatCurrency(receivedMonth)}
            icon={HandCoins}
            loading={summary.isLoading}
            accent="success"
          />
          <StatCard
            label={`Fechado em contratos${kpis.data ? ` (${kpis.data.assinados})` : ""}`}
            value={formatCurrency(kpis.data?.valorFechadoMes ?? 0)}
            icon={FileSignature}
            loading={kpis.isLoading}
          />
          <StatCard
            label="Custo mensal atual"
            value={formatCurrency(costSummary.data?.totalMonthlyBrl ?? 0)}
            icon={Wallet}
            loading={costSummary.isLoading}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ano
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Recebido no ano"
            value={formatCurrency(recebidoAno)}
            icon={Banknote}
            loading={series.isLoading}
          />
          <StatCard
            label="Fechado no ano"
            value={formatCurrency(kpis.data?.valorFechadoAno ?? 0)}
            icon={FileSignature}
            loading={kpis.isLoading}
          />
          <StatCard
            label="Consumo no ano"
            value={formatCurrency(consumoAno)}
            icon={Wallet}
            loading={usageSeries.isLoading}
          />
          <Card>
            <CardContent className="flex items-start justify-between p-5">
              <div className="flex flex-col gap-1.5">
                <p className="text-sm text-muted-foreground">Resultado do ano</p>
                {loadingResultado ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <>
                    <p
                      className={cn(
                        "text-2xl font-semibold tracking-tight",
                        resultadoAno < 0 && "text-destructive",
                      )}
                    >
                      {formatCurrency(resultadoAno)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70">
                      estimativa (custo fixo = valor atual)
                    </p>
                  </>
                )}
              </div>
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                  resultadoAno < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success",
                )}
              >
                <Scale className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
