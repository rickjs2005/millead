"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { queryKeys } from "@/lib/query-keys";
import { costsService } from "@/services/costs";
import { receivablesService } from "@/services/receivables";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/utils/format";
import type { CostUsageSeriesPoint, ReceivableSeriesPoint } from "@/types/api";

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

/** "2025-08" -> "ago/25". `new Date("YYYY-MM")` ancora em UTC meia-noite --
 * em fusos negativos (Brasil) isso vira o dia 31 do mês anterior no
 * calendário local, deslocando o rótulo em um mês. Parse manual evita o gotcha
 * (mesmo helper de monthly-chart.tsx e usage-history-section.tsx). */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const abbr = MONTH_ABBR[Number(monthNumber) - 1] ?? month;
  return `${abbr}/${year!.slice(2)}`;
}

interface ChartPoint {
  month: string;
  label: string;
  received: number;
  usageCostBrl: number;
  recurringCostBrl: number;
  cost: number;
}

/** Junta a série de recebíveis com a de consumo pela CHAVE do mês (não pelo
 * índice) -- as duas vêm zero-filled e em ordem ascendente com o mesmo N,
 * mas alinhar por chave é à prova de uma janela mudar sem a outra acompanhar.
 * `cost` usa `totalCostBrl` (consumo + recorrente) DO MÊS -- não mais a
 * constante do custo fixo atual projetada pra trás. */
function mergeSeries(
  receivableMonths: ReceivableSeriesPoint[],
  usageMonths: CostUsageSeriesPoint[],
): ChartPoint[] {
  const usageByMonth = new Map(usageMonths.map((m) => [m.month, m]));
  const merged = new Map<string, ChartPoint>();

  for (const r of receivableMonths) {
    const usage = usageByMonth.get(r.month);
    merged.set(r.month, {
      month: r.month,
      label: monthLabel(r.month),
      received: Number(r.received),
      usageCostBrl: usage?.usageCostBrl ?? 0,
      recurringCostBrl: usage?.recurringCostBrl ?? 0,
      cost: usage?.totalCostBrl ?? 0,
    });
  }
  for (const u of usageMonths) {
    if (merged.has(u.month)) continue;
    merged.set(u.month, {
      month: u.month,
      label: monthLabel(u.month),
      received: 0,
      usageCostBrl: u.usageCostBrl,
      recurringCostBrl: u.recurringCostBrl,
      cost: u.totalCostBrl,
    });
  }

  return Array.from(merged.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Tooltip customizado -- o gráfico só desenha a barra (recebido) e a linha
 * (custo total), mas o hover precisa abrir as três grandezas que compõem o
 * custo total do mês (consumo + recorrente) separadamente. */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{point.label}</p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Recebido</span>
        <span className="font-medium text-foreground">{formatCurrency(point.received)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Consumo</span>
        <span className="font-medium text-foreground">{formatCurrency(point.usageCostBrl)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Recorrente</span>
        <span className="font-medium text-foreground">
          {formatCurrency(point.recurringCostBrl)}
        </span>
      </p>
    </div>
  );
}

export function RevenueCostChart() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canView = hasPermission("proposals:read");

  // Mesma queryKey que FinanceCards usa pras mesmas séries -- React Query
  // dedupa por key, então os dois componentes no dashboard não duplicam a
  // chamada. `enabled: canView` evita bater no endpoint sem permissão (o
  // gate abaixo só esconde a UI, os hooks já rodaram nesse render).
  const receivables = useQuery({
    queryKey: queryKeys.receivables.series(12),
    queryFn: () => receivablesService.series(12),
    enabled: canView,
  });
  const usage = useQuery({
    queryKey: queryKeys.costs.usageSeries(12),
    queryFn: () => costsService.usageSeries(12),
    enabled: canView,
  });

  if (!canView) return null;

  const isLoading = receivables.isLoading || usage.isLoading;
  const isError = receivables.isError || usage.isError;

  const chartData =
    receivables.data && usage.data ? mergeSeries(receivables.data.months, usage.data.months) : [];
  const hasMovement = chartData.some((d) => d.received > 0 || d.usageCostBrl > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receita x custo mensal</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : isError ? (
          <ErrorState
            description="Não foi possível carregar a receita ou o custo mensal."
            onRetry={() => {
              receivables.refetch();
              usage.refetch();
            }}
            className="border-none py-10"
          />
        ) : !hasMovement ? (
          <EmptyState
            icon={TrendingUp}
            title="Sem movimento nos últimos 12 meses"
            className="border-none py-10"
          />
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <ComposedChart data={chartData} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(v: number) => formatCurrency(v)}
                width={90}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
              <Legend
                formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
              />
              <Bar dataKey="received" name="Recebido" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              <Line
                type="monotone"
                dataKey="cost"
                name="Custo total (consumo + recorrente)"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
