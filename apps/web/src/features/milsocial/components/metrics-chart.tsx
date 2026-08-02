"use client";

import { LineChart as LineChartIcon } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SocialPostWithMetrics } from "@/types/api";

const dayMonthFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

interface ChartPoint {
  date: string;
  reach: number | null;
  views: number | null;
}

function toChartData(posts: SocialPostWithMetrics[]): ChartPoint[] {
  return posts
    .filter((post) => post.latest !== null)
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime())
    .map((post) => ({
      date: dayMonthFormatter.format(new Date(post.publishedAt)),
      reach: post.latest!.reach,
      views: post.latest!.views,
    }));
}

export function MetricsChart({ posts }: { posts: SocialPostWithMetrics[] }) {
  const data = toChartData(posts);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alcance e views ao longo do tempo</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState
            icon={LineChartIcon}
            title="Sem métricas suficientes ainda"
            description="Assim que houver posts com snapshots de métricas, o gráfico aparece aqui."
            className="border-none py-10"
          />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} allowDecimals={false} />
              <Tooltip
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
              <Line
                type="monotone"
                dataKey="reach"
                name="Alcance"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="views"
                name="Views"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
