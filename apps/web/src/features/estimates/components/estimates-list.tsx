"use client";

import { Calculator, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDeleteEstimate } from "@/features/estimates/hooks";
import {
  ESTIMATE_STATUS_LABELS,
  ESTIMATE_STATUS_VARIANT,
} from "@/features/estimates/estimate-labels";
import { useLeads } from "@/features/leads/hooks";
import { formatCurrency, formatDate } from "@/utils/format";
import type { PricingEstimate, ProjectProduct } from "@/types/api";

function EstimateRow({
  estimate,
  leadTitle,
  productName,
}: {
  estimate: PricingEstimate;
  leadTitle?: string;
  productName?: string;
}) {
  const router = useRouter();
  const deleteEstimate = useDeleteEstimate();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => router.push(`/estimates/${estimate.id}`)}
    >
      <TableCell className="max-w-56 truncate font-medium text-foreground">
        {estimate.title}
      </TableCell>
      <TableCell className="text-muted-foreground">{leadTitle ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{productName ?? "—"}</TableCell>
      <TableCell className="font-medium text-foreground">
        {formatCurrency(estimate.computed.priceRecommended)}
      </TableCell>
      <TableCell>
        <Badge variant={ESTIMATE_STATUS_VARIANT[estimate.status]}>
          {ESTIMATE_STATUS_LABELS[estimate.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(estimate.updatedAt)}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Excluir ${estimate.title}`}
          onClick={() =>
            confirm({
              title: "Excluir orçamento",
              description: `Tem certeza que deseja excluir "${estimate.title}"? Essa ação não pode ser desfeita.`,
              confirmLabel: "Excluir",
              onConfirm: () => deleteEstimate.mutateAsync(estimate.id),
            })
          }
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        {dialog}
      </TableCell>
    </TableRow>
  );
}

export function EstimatesList({
  estimates,
  products,
  isLoading,
}: {
  estimates: PricingEstimate[];
  products: ProjectProduct[];
  isLoading: boolean;
}) {
  // Resolve nome de lead pra exibir na tabela -- a API não faz join de lead
  // no orçamento (só guarda leadId), então buscamos um lote com pageSize
  // alto e montamos o mapa localmente (mesma ideia sugerida no brief da
  // Task 6 pro select de lead do editor).
  const { data: leadsData } = useLeads({ pageSize: 100 });
  const leadTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const lead of leadsData?.items ?? []) map.set(lead.id, lead.title);
    return map;
  }, [leadsData]);
  const productNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const product of products) map.set(product.id, product.name);
    return map;
  }, [products]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <EmptyState
        icon={Calculator}
        title="Nenhum orçamento encontrado"
        description="Crie o primeiro orçamento pra precificar um cliente."
        className="border-none py-16"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Título</TableHead>
          <TableHead>Lead</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead>Preço recomendado</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Atualizado em</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {estimates.map((estimate) => (
          <EstimateRow
            key={estimate.id}
            estimate={estimate}
            leadTitle={estimate.leadId ? leadTitleById.get(estimate.leadId) : undefined}
            productName={estimate.productId ? productNameById.get(estimate.productId) : undefined}
          />
        ))}
      </TableBody>
    </Table>
  );
}
