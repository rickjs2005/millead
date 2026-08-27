"use client";

import { Plus, Repeat } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useVaultCards,
  useVaultCategories,
  useVaultMerchants,
} from "@/features/vault/finance-hooks";
import {
  formatVaultDate,
  PERIOD_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
} from "@/features/vault/format";
import {
  useCreateVaultSubscription,
  useUpdateVaultSubscription,
  useVaultSubscriptions,
} from "@/features/vault/subscription-hooks";
import type { VaultSubscriptionPeriod, VaultSubscriptionStatus } from "@/types/api";
import { formatCurrency } from "@/utils/format";

export default function CofreAssinaturasPage() {
  const subscriptions = useVaultSubscriptions();
  const update = useUpdateVaultSubscription();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <NovaAssinaturaDialog />
      </div>

      {subscriptions.isPending && <Skeleton className="h-40 w-full" />}

      {!subscriptions.isPending && (subscriptions.data?.length ?? 0) === 0 && (
        <EmptyState
          icon={Repeat}
          title="Nenhuma assinatura cadastrada"
          description="Cadastre à mão, ou importe um extrato: cobranças que se repetem viram sugestão na central de alertas — nunca cadastro automático."
        />
      )}

      {(subscriptions.data?.length ?? 0) > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assinatura</TableHead>
                <TableHead>Periodicidade</TableHead>
                <TableHead>Próxima renovação</TableHead>
                <TableHead className="text-right">Valor esperado</TableHead>
                <TableHead className="text-right">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.data!.map((subscription) => (
                <TableRow key={subscription.id}>
                  <TableCell>
                    <div className="font-medium">{subscription.name}</div>
                    {subscription.lastChargeAt && (
                      <div className="text-xs text-muted-foreground">
                        última cobrança em {formatVaultDate(subscription.lastChargeAt)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {PERIOD_LABELS[subscription.period]}
                    {subscription.period === "CUSTOM" &&
                      subscription.customIntervalDays &&
                      ` · ${subscription.customIntervalDays} dias`}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatVaultDate(subscription.nextRenewalAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(subscription.expectedCents / 100, subscription.currency)}
                    <div className="text-xs text-muted-foreground">
                      ±{subscription.priceTolerancePct}%
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Select
                      value={subscription.status}
                      onValueChange={(status) =>
                        update.mutate({
                          id: subscription.id,
                          status: status as VaultSubscriptionStatus,
                        })
                      }
                    >
                      <SelectTrigger className="ml-auto h-7 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SUBSCRIPTION_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Assinatura pausada não gera alerta — é justamente por isso que se pausa. A tolerância existe
        porque assinatura em dólar oscila com o câmbio todo mês.
      </p>
    </div>
  );
}

function NovaAssinaturaDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateVaultSubscription();
  const merchants = useVaultMerchants();
  const categories = useVaultCategories();
  const cards = useVaultCards();

  const [form, setForm] = useState({
    name: "",
    merchantId: "",
    categoryId: "",
    cardId: "",
    expectedAmount: "",
    period: "MONTHLY" as VaultSubscriptionPeriod,
    customIntervalDays: "",
    lastChargeAt: "",
  });

  async function submit() {
    await create.mutateAsync({
      name: form.name.trim(),
      merchantId: form.merchantId || null,
      categoryId: form.categoryId || null,
      accountId: null,
      cardId: form.cardId || null,
      expectedAmount: form.expectedAmount.trim(),
      currency: "BRL",
      period: form.period,
      customIntervalDays: form.period === "CUSTOM" ? Number(form.customIntervalDays) : null,
      lastChargeAt: form.lastChargeAt || null,
      nextRenewalAt: null,
      alertDaysBefore: 7,
      priceTolerancePct: 10,
      status: "ACTIVE",
      autoRenew: true,
      costSubscriptionId: null,
      notes: null,
    });
    setOpen(false);
  }

  const valido =
    form.name.trim() &&
    form.expectedAmount.trim() &&
    (form.period !== "CUSTOM" || Number(form.customIntervalDays) > 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nova assinatura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assin-nome">Nome</Label>
              <Input
                id="assin-nome"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Claude"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assin-valor">Valor esperado</Label>
              <Input
                id="assin-valor"
                inputMode="decimal"
                value={form.expectedAmount}
                onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })}
                placeholder="120.00"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="assin-forn">Fornecedor</Label>
              <Select
                value={form.merchantId}
                onValueChange={(merchantId) => setForm({ ...form, merchantId })}
              >
                <SelectTrigger id="assin-forn">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {(merchants.data ?? []).map((merchant) => (
                    <SelectItem key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                É o fornecedor que liga a cobrança do extrato a esta assinatura.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assin-cat">Categoria</Label>
              <Select
                value={form.categoryId}
                onValueChange={(categoryId) => setForm({ ...form, categoryId })}
              >
                <SelectTrigger id="assin-cat">
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.data ?? []).flatMap((root) => [
                    <SelectItem key={root.id} value={root.id}>
                      {root.name}
                    </SelectItem>,
                    ...root.children.map((child) => (
                      <SelectItem key={child.id} value={child.id}>
                        {root.name} / {child.name}
                      </SelectItem>
                    )),
                  ])}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="assin-periodo">Periodicidade</Label>
              <Select
                value={form.period}
                onValueChange={(period) =>
                  setForm({ ...form, period: period as VaultSubscriptionPeriod })
                }
              >
                <SelectTrigger id="assin-periodo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.period === "CUSTOM" && (
              <div className="space-y-1.5">
                <Label htmlFor="assin-dias">A cada (dias)</Label>
                <Input
                  id="assin-dias"
                  inputMode="numeric"
                  value={form.customIntervalDays}
                  onChange={(e) => setForm({ ...form, customIntervalDays: e.target.value })}
                  placeholder="90"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="assin-ultima">Última cobrança</Label>
              <Input
                id="assin-ultima"
                type="date"
                value={form.lastChargeAt}
                onChange={(e) => setForm({ ...form, lastChargeAt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assin-cartao">Cartão</Label>
            <Select value={form.cardId} onValueChange={(cardId) => setForm({ ...form, cardId })}>
              <SelectTrigger id="assin-cartao">
                <SelectValue placeholder="Opcional" />
              </SelectTrigger>
              <SelectContent>
                {(cards.data ?? []).map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Informando a última cobrança, a próxima renovação é calculada sozinha. Sem ela, fica em
            aberto até a primeira cobrança aparecer no extrato.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!valido || create.isPending}>
            {create.isPending ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
