"use client";

import { AlertTriangle, PieChart, Wallet } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { useCostSummary } from "@/features/finance/hooks";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/utils/format";

/**
 * Resumo de custos no dashboard: custo fixo mensal + rateio por cliente
 * ativo, com alerta quando a capacidade da infraestrutura está apertada
 * (>= 80%, vermelho a partir de 100%). "Custo por cliente ativo" precisa
 * de uma segunda linha de descrição que o StatCard genérico não suporta --
 * por isso é montado à mão, igual ao CostSummaryCards em /costs.
 *
 * Usa a MESMA queryKey (`queryKeys.costs.summary()`) que `FinanceCards`
 * consome na mesma página `/dashboard` -- React Query dedupa por key, não
 * duplica a chamada. `FinanceCards` já trata `isError` corretamente pra
 * essa query; aqui aplicamos o mesmo padrão: em erro, os valores viram
 * `null` (`formatCurrency` já retorna "—") em vez de cair no fallback `?? 0`,
 * que mostraria "R$ 0,00"/"0%" como se fosse dado real.
 */
export function CostSummaryTiles() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission("proposals:read");

  const { data: summary, isLoading, isError } = useCostSummary({ enabled: canView });

  if (!canView) return null;

  const agencyMonthlyValue = isError ? null : (summary?.agencyMonthlyBrl ?? 0);
  const perClientShareValue = isError ? null : (summary?.perClientShareBrl ?? 0);
  const maxPct = isError ? null : (summary?.maxCapacityPct ?? null);
  const showAlert = maxPct !== null && maxPct >= 80;
  const isCritical = maxPct !== null && maxPct >= 100;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Custo fixo mensal"
          value={formatCurrency(agencyMonthlyValue)}
          icon={Wallet}
          loading={isLoading}
        />
        <Card>
          <CardContent className="flex items-start justify-between p-5">
            <div className="flex flex-col gap-1.5">
              <p className="text-sm text-muted-foreground">Custo por cliente ativo</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : isError ? (
                <>
                  <p className="text-2xl font-semibold tracking-tight text-muted-foreground">—</p>
                  <p className="text-[11px] text-muted-foreground/70">não foi possível calcular</p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-semibold tracking-tight">
                    {formatCurrency(perClientShareValue)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    rateio entre {summary?.activeClientsCount ?? 0} cliente
                    {summary?.activeClientsCount === 1 ? "" : "s"}
                  </p>
                </>
              )}
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PieChart className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {showAlert && (
        <Link
          href="/costs"
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
            isCritical
              ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "border-warning/40 bg-warning/10 text-warning hover:bg-warning/15",
          )}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Infraestrutura em {maxPct}% — veja o Centro de Custos
        </Link>
      )}
    </div>
  );
}
