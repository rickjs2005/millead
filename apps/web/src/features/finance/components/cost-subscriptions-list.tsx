"use client";

import { Pencil, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CostSubscriptionDialog } from "@/features/finance/components/cost-subscription-dialog";
import { SCOPE_LABELS } from "@/features/finance/finance-labels";
import {
  useCostSubscriptions,
  useDeleteCostSubscription,
  useFinanceSettings,
  useUpdateCostSubscription,
} from "@/features/finance/hooks";
import { formatCurrency } from "@/utils/format";
import type { CostScope, CostSubscription } from "@/types/api";

function monthlyBrl(subscription: CostSubscription, rate: number) {
  const brl =
    subscription.currency === "USD"
      ? Number(subscription.amount) * rate
      : Number(subscription.amount);
  return subscription.billingCycle === "YEARLY" ? brl / 12 : brl;
}

function CostSubscriptionRow({
  subscription,
  usdToBrlRate,
}: {
  subscription: CostSubscription;
  usdToBrlRate: number;
}) {
  const updateCostSubscription = useUpdateCostSubscription();
  const deleteCostSubscription = useDeleteCostSubscription();
  const { confirm, dialog } = useConfirmDialog();

  const cycleSuffix = subscription.billingCycle === "YEARLY" ? "/ano" : "/mês";
  const hasCapacity = subscription.capacityLimit !== null && subscription.capacityUsed !== null;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{subscription.name}</span>
          {subscription.notes && (
            <span className="text-xs text-muted-foreground">{subscription.notes}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="secondary">{SCOPE_LABELS[subscription.scope]}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span>
            {subscription.currency === "USD"
              ? `US$ ${Number(subscription.amount).toFixed(2)}`
              : formatCurrency(subscription.amount)}
            {cycleSuffix}
          </span>
          {subscription.currency === "USD" && (
            <span className="text-xs text-muted-foreground">
              ≈ {formatCurrency(monthlyBrl(subscription, usdToBrlRate))}/mês
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {hasCapacity ? `${subscription.capacityUsed}/${subscription.capacityLimit}` : "—"}
      </TableCell>
      <TableCell>
        <Switch
          checked={subscription.isActive}
          onCheckedChange={(checked) =>
            updateCostSubscription.mutate({ id: subscription.id, payload: { isActive: checked } })
          }
          aria-label={subscription.isActive ? "Desativar assinatura" : "Ativar assinatura"}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <CostSubscriptionDialog
            subscription={subscription}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Editar ${subscription.name}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${subscription.name}`}
            onClick={() =>
              confirm({
                title: "Excluir assinatura",
                description: `Tem certeza que deseja excluir "${subscription.name}"? Essa ação não pode ser desfeita.`,
                confirmLabel: "Excluir",
                onConfirm: () => deleteCostSubscription.mutateAsync(subscription.id),
              })
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {dialog}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function CostSubscriptionsList() {
  const { data, isLoading, isError, refetch } = useCostSubscriptions();
  const { data: settings } = useFinanceSettings();
  const [scope, setScope] = useState<CostScope | "ALL">("ALL");

  const usdToBrlRate = settings ? Number(settings.usdToBrlRate) : 0;
  const filtered = (data ?? []).filter((s) => scope === "ALL" || s.scope === scope);

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Select value={scope} onValueChange={(v) => setScope(v as CostScope | "ALL")}>
          <SelectTrigger className="w-48" aria-label="Filtrar por escopo">
            <SelectValue placeholder="Escopo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="AGENCY">Agência</SelectItem>
            <SelectItem value="CLIENT">Por cliente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} className="border-none" />
      ) : isLoading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Nenhuma assinatura encontrada"
          description={
            data && data.length > 0
              ? "Nenhuma assinatura nesse escopo."
              : "Cadastre a primeira assinatura de custo fixo ou de infra de cliente."
          }
          action={<CostSubscriptionDialog trigger={<Button>Adicionar assinatura</Button>} />}
          className="border-none py-16"
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Escopo</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Capacidade</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((subscription) => (
              <CostSubscriptionRow
                key={subscription.id}
                subscription={subscription}
                usdToBrlRate={usdToBrlRate}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
