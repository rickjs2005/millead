"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useCostSummary } from "@/features/finance/hooks";
import type { CapacityEntry } from "@/types/api";

function capacityStatus(pct: number) {
  if (pct >= 100) {
    return {
      label: "Estourado",
      badgeVariant: "destructive" as const,
      indicatorClassName: "bg-destructive",
    };
  }
  if (pct >= 80) {
    return {
      label: "Atenção",
      badgeVariant: "warning" as const,
      indicatorClassName: "bg-warning",
    };
  }
  return null;
}

function CapacityRow({ entry }: { entry: CapacityEntry }) {
  const status = capacityStatus(entry.pct);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{entry.name}</p>
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {entry.used}/{entry.limit} projetos · {entry.pct}%
          </p>
          {status ? <Badge variant={status.badgeVariant}>{status.label}</Badge> : null}
        </div>
      </div>
      <Progress
        value={Math.min(entry.pct, 100)}
        indicatorClassName={status?.indicatorClassName}
      />
    </div>
  );
}

export function CapacitySection() {
  const { data: summary, isLoading } = useCostSummary();
  const capacity = summary?.capacity ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Capacidade da infraestrutura</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : capacity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Defina limite e uso nas assinaturas para acompanhar a capacidade.
          </p>
        ) : (
          <>
            {capacity.map((entry) => (
              <CapacityRow key={entry.id} entry={entry} />
            ))}
            <p className="text-xs text-muted-foreground">Edite os números na própria assinatura.</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
