"use client";

import { Wallet2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsageSeries } from "@/features/finance/hooks";
import { formatCurrency } from "@/utils/format";
import type { CostUsageSeriesPoint } from "@/types/api";

const MONTH_ABBR = [
  "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez",
];

/** "2025-08" -> "ago/25". `new Date("YYYY-MM")` ancora em UTC meia-noite --
 * em fusos negativos (Brasil) isso vira o dia 31 do mês anterior no
 * calendário local, deslocando o rótulo em um mês. Parse manual evita o gotcha. */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const abbr = MONTH_ABBR[Number(monthNumber) - 1] ?? month;
  return `${abbr}/${year!.slice(2)}`;
}

function toChartData(months: CostUsageSeriesPoint[]) {
  return months.map((m) => ({
    label: monthLabel(m.month),
    usageCostBrl: m.usageCostBrl,
    recurringCostBrl: m.recurringCostBrl,
    totalCostBrl: m.totalCostBrl,
  }));
}

interface ChartTooltipPoint {
  label: string;
  usageCostBrl: number;
  recurringCostBrl: number;
  totalCostBrl: number;
}

/** Tooltip custom -- as barras empilhadas mostram só 2 séries visualmente,
 * mas o hover precisa abrir as 3 grandezas (consumo, recorrente, total). */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartTooltipPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1.5 font-medium">{point.label}</p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Consumo</span>
        <span className="font-medium text-foreground">{formatCurrency(point.usageCostBrl)}</span>
      </p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Recorrente (assinaturas)</span>
        <span className="font-medium text-foreground">
          {formatCurrency(point.recurringCostBrl)}
        </span>
      </p>
      <p className="flex items-center justify-between gap-4 text-muted-foreground">
        <span>Total</span>
        <span className="font-medium text-foreground">{formatCurrency(point.totalCostBrl)}</span>
      </p>
    </div>
  );
}

/** Histórico mensal de custos (consumo + recorrente) acima da seção de
 * consumo do mês corrente. Barras empilhadas: consumo de créditos embaixo,
 * custo recorrente (assinaturas) em cima. A `ReferenceLine` mostra o custo
 * fixo ATUAL (`recurringMonthlyBrl`) como referência visual do valor de
 * hoje -- diferente da barra recorrente por mês (que é uma aproximação
 * histórica: assinatura ativa conta a partir da própria data de cadastro,
 * inativa não conta em mês nenhum por falta de data de cancelamento). */
export function UsageHistorySection() {
  const { data, isLoading, isError, refetch } = useUsageSeries(12);
  const chartData = toChartData(data?.months ?? []);
  const hasUsage = chartData.some((m) => m.usageCostBrl > 0 || m.recurringCostBrl > 0);
  const recurringMonthlyBrl = data?.recurringMonthlyBrl ?? 0;
  // Igual ao critério de `receivables/page.tsx`: em erro, valor vira `null`
  // (formatCurrency renderiza "—") em vez de somar 0 e mostrar um total falso.
  const yearGrandTotalValue = isError ? null : (data?.yearGrandTotal ?? 0);
  const yearTotalValue = isError ? null : (data?.yearTotal ?? 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Histórico de custos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recorrente estimado pela data de cadastro de cada assinatura -- sem histórico de
            cancelamento, assinatura ativa conta desde que foi cadastrada, inativa não conta.
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Custo no ano</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatCurrency(yearGrandTotalValue)}
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              consumo {formatCurrency(yearTotalValue)}
            </p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : isError ? (
          // Erro de rede não pode cair no empty-state "Sem custo lançado" --
          // isso esconderia o problema atrás de um "não há dado" enganoso.
          <ErrorState onRetry={() => refetch()} className="border-none py-10" />
        ) : !hasUsage ? (
          <EmptyState
            icon={Wallet2}
            title="Sem custo lançado nos últimos 12 meses"
            className="border-none py-10"
          />
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={chartData} margin={{ left: 8, right: 16, top: 12 }}>
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
              <Bar
                dataKey="usageCostBrl"
                name="Consumo"
                stackId="cost"
                fill="hsl(var(--chart-1))"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="recurringCostBrl"
                name="Recorrente (assinaturas)"
                stackId="cost"
                fill="hsl(var(--chart-2))"
                radius={[4, 4, 0, 0]}
              />
              {recurringMonthlyBrl > 0 ? (
                <ReferenceLine
                  y={recurringMonthlyBrl}
                  ifOverflow="extendDomain"
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="4 4"
                  label={{
                    value: "custo fixo atual",
                    position: "insideTopRight",
                    fill: "hsl(var(--destructive))",
                    fontSize: 12,
                  }}
                />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
