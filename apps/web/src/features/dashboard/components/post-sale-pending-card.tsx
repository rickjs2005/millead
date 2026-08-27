"use client";

import { RefreshCw, Workflow } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingAutomations, useReprocessPostSale } from "@/features/post-sale/hooks";
import {
  AUTOMATION_STATUS_LABELS,
  AUTOMATION_STATUS_VARIANT,
  AUTOMATION_STEP_LABELS,
} from "@/features/post-sale/labels";
import { useAuthStore } from "@/stores/auth-store";
import type { PendingAutomation } from "@/types/api";

/** Botão isolado num componente porque `useReprocessPostSale` é por contrato
 *  -- chamar o hook dentro do `.map()` seria hook condicional. */
function ReprocessButton({ contractId }: { contractId: string }) {
  const reprocess = useReprocessPostSale(contractId);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      disabled={reprocess.isPending}
      onClick={() => reprocess.mutate()}
      aria-label="Reprocessar automação"
      title="Roda só as etapas que não concluíram"
    >
      <RefreshCw className={reprocess.isPending ? "animate-spin" : undefined} />
    </Button>
  );
}

function PendingRow({ item, canWrite }: { item: PendingAutomation; canWrite: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Link
          href={`/contracts/${item.contractId}`}
          className="truncate text-sm font-medium hover:underline"
        >
          {item.companyName ?? item.contractNumero}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {item.companyName ? `${item.contractNumero} · ` : ""}
          {item.pendingSteps.length > 0
            ? item.pendingSteps.map((s) => AUTOMATION_STEP_LABELS[s.key]).join(", ")
            : "Aguardando processamento"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant={AUTOMATION_STATUS_VARIANT[item.status]}>
          {AUTOMATION_STATUS_LABELS[item.status]}
        </Badge>
        {canWrite && <ReprocessButton contractId={item.contractId} />}
      </div>
    </div>
  );
}

/**
 * Contratos assinados cuja automação pós-fechamento parou no meio. É a única
 * tela que mostra isso de forma agregada -- no detalhe do contrato você só vê
 * a automação daquele contrato, e ninguém abre contrato por contrato pra
 * descobrir o que ficou pendente.
 */
export function PostSalePendingCard() {
  const { data, isLoading } = usePendingAutomations();
  const canWrite = useAuthStore((s) => s.hasPermission)("proposals:write");
  const items = data ?? [];

  return (
    <Card className={items.length > 0 ? "border-warning/40" : undefined}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Workflow className="h-4 w-4 text-warning" />
          Pós-fechamento pendente
        </CardTitle>
        <Link
          href="/settings/automation"
          className="text-xs font-medium text-primary hover:underline"
        >
          Configurar
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState
            icon={Workflow}
            title="Nada pendente"
            description="Todo contrato assinado foi processado até o fim."
            className="border-none py-8"
          />
        ) : (
          items.map((item) => (
            <PendingRow key={item.executionId} item={item} canWrite={canWrite} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
