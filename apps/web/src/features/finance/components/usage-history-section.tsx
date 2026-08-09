"use client";

import { Wallet2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/empty-state";
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
  }));
}

/** Histórico mensal de consumo (créditos convertidos em BRL) acima da seção
 * de consumo do mês corrente. A `ReferenceLine` mostra o custo fixo ATUAL
 * (`recurringMonthlyBrl`) como referência visual -- não é uma série
 * histórica de assinaturas, é o mesmo valor de hoje projetado pra trás,
 * por isso o sublabel deixa a limitação explícita. */
export function UsageHistorySection() {
  const { data, isLoading } = useUsageSeries(12);
  const chartData = toChartData(data?.months ?? []);
  const hasUsage = chartData.some((m) => m.usageCostBrl > 0);
  const recurringMonthlyBrl = data?.recurringMonthlyBrl ?? 0;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>Histórico de consumo</CardTitle>
          <p className="text-sm text-muted-foreground">
            Custo fixo exibido é o valor atual das assinaturas -- sem histórico de quanto ele era em
            cada mês.
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Consumo no ano</p>
            <p className="text-lg font-semibold tabular-nums">{formatCurrency(data?.yearTotal ?? 0)}</p>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : !hasUsage ? (
          <EmptyState
            icon={Wallet2}
            title="Sem consumo lançado nos últimos 12 meses"
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
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="usageCostBrl"
                name="Consumo"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
              {recurringMonthlyBrl > 0 ? (
                <ReferenceLine
                  y={recurringMonthlyBrl}
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
