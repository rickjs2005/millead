"use client";

import { BarChart3 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StandaloneDialog } from "@/features/receivables/components/standalone-dialog";
import { useReceivablesSeries } from "@/features/receivables/hooks";
import { formatCurrency } from "@/utils/format";
import type { ReceivableSeriesPoint } from "@/types/api";

const MONTH_ABBR = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** "2025-08" -> "ago/25". `new Date("YYYY-MM")` ancora em UTC meia-noite --
 * em fusos negativos (Brasil) isso vira o dia 31 do mês anterior no
 * calendário local, deslocando o rótulo em um mês. Parse manual evita o gotcha. */
function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  const abbr = MONTH_ABBR[Number(monthNumber) - 1] ?? month;
  return `${abbr}/${year!.slice(2)}`;
}

function toChartData(months: ReceivableSeriesPoint[]) {
  return months.map((m) => ({
    label: monthLabel(m.month),
    received: Number(m.received),
    expected: Number(m.expected),
  }));
}

export function MonthlyChart() {
  const { data, isLoading, isError, refetch } = useReceivablesSeries(12);
  const chartData = toChartData(data?.months ?? []);
  const hasMovement = chartData.some((m) => m.received > 0 || m.expected > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recebido x previsto por mês</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : isError ? (
          // Erro de rede não pode cair no empty-state "Sem movimento" --
          // isso esconderia o problema atrás de um "não há dado" enganoso.
          <ErrorState onRetry={() => refetch()} className="border-none py-10" />
        ) : !hasMovement ? (
          <EmptyState
            icon={BarChart3}
            title="Sem movimento nos últimos 12 meses"
            action={<StandaloneDialog trigger={<Button size="sm">Lançar receita</Button>} />}
            className="border-none py-10"
          />
        ) : (
          <ResponsiveContainer width="100%" height={288}>
            <BarChart data={chartData} margin={{ left: 8, right: 16 }}>
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
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
              <Bar
                dataKey="received"
                name="Recebido"
                fill="hsl(var(--chart-3))"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expected"
                name="Previsto"
                fill="hsl(var(--chart-1))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
