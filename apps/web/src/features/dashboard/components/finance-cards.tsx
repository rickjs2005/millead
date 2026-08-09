"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  FileSignature,
  HandCoins,
  Receipt,
  Scale,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { contractsService } from "@/services/contracts";
import { costsService } from "@/services/costs";
import { leadsService } from "@/services/leads";
import { receivablesService } from "@/services/receivables";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/utils/format";

/**
 * Duas linhas: "Este mês" (granularidade do mês corrente) e "Ano" (totais do
 * ano civil corrente). Esses dois blocos de card vivem atrás de
 * `proposals:read` (`canView` -- contratos, recebíveis e custos são a mesma
 * área financeira). O alerta de "ganhos sem contrato" logo abaixo é
 * independente: só precisa de `leads:read` (`canLeads`) -- um SDR sem
 * `proposals:read` não vê os cards financeiros, mas continua vendo o alerta.
 * Por isso o componente só retorna `null` quando NENHUMA das duas permissões
 * existe (gate OR, igual o código pré-Task 7) -- gate AND aqui esconderia o
 * alerta de quem só tem `leads:read`.
 *
 * Cada valor exibido só é calculado se a query que o alimenta NÃO estiver em
 * erro -- se `summary` falhar mas `usageSeries` carregar, por exemplo, os
 * cards que dependem de `summary` mostram "—", nunca um fallback silencioso
 * em 0 (isso já rendeu um "Resultado do ano" negativo GRANDE e enganoso
 * quando só a série de recebíveis falhava).
 *
 * As duas queries de série (`receivables.series(12)` e `costs.usageSeries(12)`)
 * usam a MESMA queryKey que RevenueCostChart -- React Query dedupa por key,
 * então os dois componentes no dashboard não duplicam a chamada.
 */
export function FinanceCards() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission("proposals:read");
  const canLeads = hasPermission("leads:read");

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
  // Único consumidor de `GET /leads/finance` no dashboard: alimenta só o
  // alerta de "ganhos sem contrato" abaixo das duas fileiras.
  const finance = useQuery({
    queryKey: ["dashboard", "leads", "finance"],
    queryFn: leadsService.finance,
    enabled: canLeads,
  });

  if (!canView && !canLeads) return null;

  // ---- Este mês ----
  const toReceive = Number(summary.data?.toReceive ?? 0);
  const overdue = Number(summary.data?.overdue ?? 0);
  const overdueCount = summary.data?.overdueItems.length ?? 0;
  const toReceiveValue = summary.isError ? null : toReceive + overdue;
  const receivedMonthValue = summary.isError ? null : Number(summary.data?.received ?? 0);
  const fechadoMesValue = kpis.isError ? null : (kpis.data?.valorFechadoMes ?? 0);
  const custoMensalValue = costSummary.isError ? null : (costSummary.data?.totalMonthlyBrl ?? 0);

  // ---- Ano ----
  const recebidoAno = Number(series.data?.yearTotals.received ?? 0);
  const consumoAno = usageSeries.data?.yearTotal ?? 0;
  const yearGrandTotal = usageSeries.data?.yearGrandTotal ?? 0;
  const recebidoAnoValue = series.isError ? null : recebidoAno;
  const fechadoAnoValue = kpis.isError ? null : (kpis.data?.valorFechadoAno ?? 0);
  const consumoAnoValue = usageSeries.isError ? null : consumoAno;

  const loadingResultado = series.isLoading || usageSeries.isLoading;
  const resultadoError = series.isError || usageSeries.isError;
  // `yearGrandTotal` já soma consumo + recorrente (estimado pela data de
  // cadastro de cada assinatura, mês a mês) -- mais honesto que o custo fixo
  // ATUAL multiplicado pelos meses decorridos (constante, ignorava altas/baixas
  // de assinatura ao longo do ano).
  const resultadoAno = recebidoAno - yearGrandTotal;

  // ---- Alerta: ganhos sem contrato ----
  const wonWithoutContractCount = finance.data?.wonWithoutContractCount ?? 0;
  const showWonWithoutContractAlert =
    canLeads && !finance.isError && wonWithoutContractCount > 0;

  return (
    <div className="flex flex-col gap-6">
      {canView && (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Este mês
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={`A receber${overdueCount > 0 ? ` (${overdueCount} vencidas)` : ""}`}
                value={formatCurrency(toReceiveValue)}
                icon={Receipt}
                loading={summary.isLoading}
                accent={!summary.isError && overdue > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Recebido"
                value={formatCurrency(receivedMonthValue)}
                icon={HandCoins}
                loading={summary.isLoading}
                accent="success"
              />
              <StatCard
                label={`Fechado em contratos${kpis.data ? ` (${kpis.data.assinados})` : ""}`}
                value={formatCurrency(fechadoMesValue)}
                icon={FileSignature}
                loading={kpis.isLoading}
              />
              <StatCard
                label="Custo mensal atual"
                value={formatCurrency(custoMensalValue)}
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
                value={formatCurrency(recebidoAnoValue)}
                icon={Banknote}
                loading={series.isLoading}
              />
              <StatCard
                label="Fechado no ano"
                value={formatCurrency(fechadoAnoValue)}
                icon={FileSignature}
                loading={kpis.isLoading}
              />
              <StatCard
                label="Consumo no ano"
                value={formatCurrency(consumoAnoValue)}
                icon={Wallet}
                loading={usageSeries.isLoading}
              />
              <Card>
                <CardContent className="flex items-start justify-between p-5">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm text-muted-foreground">Resultado do ano</p>
                    {loadingResultado ? (
                      <Skeleton className="h-8 w-24" />
                    ) : resultadoError ? (
                      <>
                        <p className="text-2xl font-semibold tracking-tight text-muted-foreground">
                          —
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">
                          não foi possível calcular
                        </p>
                      </>
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
                          custos do ano (consumo + assinaturas)
                        </p>
                      </>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      resultadoError
                        ? "bg-muted text-muted-foreground"
                        : resultadoAno < 0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-success/10 text-success",
                    )}
                  >
                    <Scale className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {showWonWithoutContractAlert && (
        <Link
          href="/leads?status=WON"
          className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm font-medium text-warning transition-colors hover:bg-warning/15"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {wonWithoutContractCount} lead{wonWithoutContractCount === 1 ? "" : "s"} ganho
          {wonWithoutContractCount === 1 ? "" : "s"} sem contrato assinado —{" "}
          {formatCurrency(finance.data?.wonWithoutContractSum ?? 0)}
        </Link>
      )}
    </div>
  );
}
