"use client";

import { CreditCard, PieChart, Server, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { useCostSummary } from "@/features/finance/hooks";
import { formatCurrency } from "@/utils/format";

/** "Rateio por cliente ativo" precisa de uma segunda linha de descrição
 * (R$ X ÷ N clientes) que o StatCard genérico não suporta -- por isso
 * este card é montado à mão em vez de reusar o StatCard aqui. */
export function CostSummaryCards() {
  const { data: summary, isLoading, isError } = useCostSummary();

  // Igual ao critério de `receivables/page.tsx`: em erro, valor vira `null`
  // (formatCurrency renderiza "—") em vez de cair no `?? 0` e mostrar
  // custo/rateio falso.
  const agencyMonthlyValue = isError ? null : (summary?.agencyMonthlyBrl ?? 0);
  const clientMonthlyValue = isError ? null : (summary?.clientMonthlyBrl ?? 0);
  const perClientShareValue = isError ? null : (summary?.perClientShareBrl ?? 0);
  const activeSubscriptionsValue = isError ? "—" : (summary?.activeSubscriptions ?? 0);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Custo fixo mensal"
        value={formatCurrency(agencyMonthlyValue)}
        icon={Wallet}
        loading={isLoading}
      />
      <StatCard
        label="Infra de clientes/mês"
        value={formatCurrency(clientMonthlyValue)}
        icon={Server}
        loading={isLoading}
      />
      <Card>
        <CardContent className="flex items-start justify-between p-5">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-muted-foreground">Rateio por cliente ativo</p>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-semibold tracking-tight">
                  {formatCurrency(perClientShareValue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isError ? (
                    "—"
                  ) : (
                    <>
                      {formatCurrency(agencyMonthlyValue)} ÷ {summary?.activeClientsCount ?? 0}{" "}
                      cliente
                      {summary?.activeClientsCount === 1 ? "" : "s"}
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <PieChart className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
      <StatCard
        label="Assinaturas ativas"
        value={activeSubscriptionsValue}
        icon={CreditCard}
        loading={isLoading}
      />
    </div>
  );
}
