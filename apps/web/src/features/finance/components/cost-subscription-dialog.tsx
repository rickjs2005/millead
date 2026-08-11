"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCostCatalog,
  useCreateCostSubscription,
  useFinanceSettings,
  useUpdateCostSubscription,
} from "@/features/finance/hooks";
import { CATEGORY_LABELS, CYCLE_LABELS, SCOPE_LABELS } from "@/features/finance/finance-labels";
import { formatCurrency } from "@/utils/format";
import type {
  CostBillingCycle,
  CostCategory,
  CostCurrency,
  CostScope,
  CostServiceCatalogItem,
  CostSubscription,
  CostSubscriptionPayload,
} from "@/types/api";

/** Empty string vira undefined antes do z.coerce.number() -- sem isso, um
 * campo de capacidade deixado em branco seria coagido pra 0 (Number("") === 0),
 * o que implicaria "capacidade zero" em vez de "sem limite definido". */
const optionalInt = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().min(0, "Deve ser um número positivo.").optional(),
);

const schema = z.object({
  name: z.string().min(2, "Informe um nome com pelo menos 2 caracteres."),
  scope: z.enum(["AGENCY", "CLIENT"]),
  amount: z.coerce.number().min(0, "Informe um valor válido."),
  currency: z.enum(["BRL", "USD"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  capacityLimit: optionalInt,
  capacityUsed: optionalInt,
  creditsIncluded: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1, "Deve ser maior que zero.").optional(),
  ),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function monthlyBrl(amount: number, currency: CostCurrency, cycle: CostBillingCycle, rate: number) {
  const brl = currency === "USD" ? amount * rate : amount;
  return cycle === "YEARLY" ? brl / 12 : brl;
}

function groupCatalogByCategory(catalog: CostServiceCatalogItem[]) {
  const groups = {} as Record<CostCategory, CostServiceCatalogItem[]>;
  for (const item of catalog) {
    (groups[item.category] ??= []).push(item);
  }
  return groups;
}

/** Dialog compartilhado de criar/editar: passe `subscription` pra entrar em modo edição.
 * No modo criar, o Select de catálogo é só um atalho de preenchimento -- todos os
 * campos continuam editáveis (o Rick pediu isso: preço subiu/baixou, ele muda). */
export function CostSubscriptionDialog({
  subscription,
  trigger,
}: {
  subscription?: CostSubscription;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [catalogKey, setCatalogKey] = useState<string | undefined>(undefined);
  const isEdit = !!subscription;

  const { data: catalog } = useCostCatalog();
  const { data: settings } = useFinanceSettings();
  const createCostSubscription = useCreateCostSubscription();
  const updateCostSubscription = useUpdateCostSubscription();
  const pending = isEdit ? updateCostSubscription.isPending : createCostSubscription.isPending;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: subscription?.name ?? "",
      scope: subscription?.scope ?? "AGENCY",
      amount: subscription ? Number(subscription.amount) : 0,
      currency: subscription?.currency ?? "BRL",
      billingCycle: subscription?.billingCycle ?? "MONTHLY",
      capacityLimit: subscription?.capacityLimit ?? undefined,
      capacityUsed: subscription?.capacityUsed ?? undefined,
      creditsIncluded: subscription?.creditsIncluded ?? undefined,
      notes: subscription?.notes ?? "",
    },
  });

  const amount = watch("amount");
  const currency = watch("currency");
  const billingCycle = watch("billingCycle");
  const creditsIncluded = watch("creditsIncluded");
  const rate = settings ? Number(settings.usdToBrlRate) : 0;
  const catalogItem = catalog?.find((c) => c.key === catalogKey);
  const groupedCatalog = groupCatalogByCategory(catalog ?? []);

  function applyCatalogItem(key: string) {
    const item = catalog?.find((c) => c.key === key);
    if (!item) return;
    setCatalogKey(key);
    setValue("name", item.name);
    setValue("scope", item.defaultScope);
    setValue("amount", Number(item.defaultAmount));
    setValue("currency", item.currency);
    setValue("billingCycle", item.billingCycle);
    if (item.defaultCapacityLimit !== null) {
      setValue("capacityLimit", item.defaultCapacityLimit);
    }
  }

  async function onSubmit(values: FormValues) {
    const payload: CostSubscriptionPayload = {
      name: values.name,
      scope: values.scope,
      amount: values.amount,
      currency: values.currency,
      billingCycle: values.billingCycle,
      capacityLimit: values.capacityLimit ?? null,
      capacityUsed: values.capacityUsed ?? null,
      creditsIncluded: values.creditsIncluded ?? null,
      notes: values.notes || null,
    };
    if (isEdit) {
      await updateCostSubscription.mutateAsync({ id: subscription.id, payload });
    } else {
      await createCostSubscription.mutateAsync({ ...payload, serviceKey: catalogKey ?? undefined });
      reset();
      setCatalogKey(undefined);
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            {!isEdit && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-catalog">A partir do catálogo (opcional)</Label>
                <Select value={catalogKey} onValueChange={applyCatalogItem}>
                  <SelectTrigger id="cost-catalog">
                    <SelectValue placeholder="Selecione um serviço do catálogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedCatalog).map(([category, items]) => (
                      <SelectGroup key={category}>
                        <SelectLabel>{CATEGORY_LABELS[category as CostCategory]}</SelectLabel>
                        {items.map((item) => (
                          <SelectItem key={item.key} value={item.key}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {catalogItem && (catalogItem.billingNotes || catalogItem.bestFor) && (
                  <p className="text-xs text-muted-foreground">
                    {catalogItem.billingNotes}
                    {catalogItem.billingNotes && catalogItem.bestFor ? " — " : ""}
                    {catalogItem.bestFor}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost-name">Nome</Label>
              <Input id="cost-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-scope">Escopo</Label>
                <Controller
                  control={control}
                  name="scope"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as CostScope)}
                    >
                      <SelectTrigger id="cost-scope">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-cycle">Ciclo de cobrança</Label>
                <Controller
                  control={control}
                  name="billingCycle"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as CostBillingCycle)}
                    >
                      <SelectTrigger id="cost-cycle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CYCLE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-amount">Valor</Label>
                <Input id="cost-amount" inputMode="decimal" {...register("amount")} />
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount.message}</p>
                )}
                {currency === "USD" && rate > 0 && (
                  <p className="text-xs text-muted-foreground">
                    ≈{" "}
                    {formatCurrency(monthlyBrl(Number(amount || 0), currency, billingCycle, rate))}
                    /mês no câmbio atual
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-currency">Moeda</Label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as CostCurrency)}
                    >
                      <SelectTrigger id="cost-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">R$ (BRL)</SelectItem>
                        <SelectItem value="USD">US$ (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-capacity-limit">Limite de capacidade</Label>
                <Input
                  id="cost-capacity-limit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...register("capacityLimit")}
                />
                {errors.capacityLimit && (
                  <p className="text-xs text-destructive">{errors.capacityLimit.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cost-capacity-used">Capacidade usada</Label>
                <Input
                  id="cost-capacity-used"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  {...register("capacityUsed")}
                />
                {errors.capacityUsed && (
                  <p className="text-xs text-destructive">{errors.capacityUsed.message}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost-credits-included">Créditos inclusos/mês (opcional)</Label>
              <Input
                id="cost-credits-included"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="Ex.: 1000"
                {...register("creditsIncluded")}
              />
              {errors.creditsIncluded && (
                <p className="text-xs text-destructive">{errors.creditsIncluded.message}</p>
              )}
              {!!creditsIncluded && creditsIncluded > 0 && (currency === "BRL" || rate > 0) && (
                <p className="text-xs text-muted-foreground">
                  ≈{" "}
                  {formatCurrency(
                    monthlyBrl(Number(amount || 0), currency, billingCycle, rate) / creditsIncluded,
                  )}{" "}
                  por crédito
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cost-notes">Observações</Label>
              <Textarea id="cost-notes" rows={2} {...register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar assinatura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
