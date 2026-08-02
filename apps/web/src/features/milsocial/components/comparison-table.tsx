"use client";

import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FORMAT_LABELS, fmtNum, fmtWatchTime } from "@/features/milsocial/labels";
import type { FormatComparisonRow } from "@/types/api";

/** nulls sempre por último, independente da direção do sort. */
function byAvgViewsDesc(a: FormatComparisonRow, b: FormatComparisonRow): number {
  if (a.avgViews == null && b.avgViews == null) return 0;
  if (a.avgViews == null) return 1;
  if (b.avgViews == null) return -1;
  return b.avgViews - a.avgViews;
}

export function ComparisonTable({ rows }: { rows: FormatComparisonRow[] }) {
  const sorted = [...rows].sort(byAvgViewsDesc);

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="pb-0">
        <CardTitle>Comparação por formato</CardTitle>
      </CardHeader>
      {sorted.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Sem dados de comparação ainda"
          description="Sincronize os posts pra ver o desempenho médio de cada formato."
          className="border-none py-10"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Formato</TableHead>
              <TableHead className="text-right">Posts</TableHead>
              <TableHead className="text-right">Alcance médio</TableHead>
              <TableHead className="text-right">Views médias</TableHead>
              <TableHead className="text-right">Retenção média</TableHead>
              <TableHead className="text-right">Interações médias</TableHead>
              <TableHead className="text-right">Visitas ao perfil</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.format}>
                <TableCell className="font-medium text-foreground">
                  {FORMAT_LABELS[row.format]}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.postCount}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(row.avgReach)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(row.avgViews)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtWatchTime(row.avgWatchTimeMs)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNum(row.avgInteractions)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtNum(row.avgProfileVisits)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
