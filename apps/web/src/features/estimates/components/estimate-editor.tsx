"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EstimateResultPanel } from "@/features/estimates/components/estimate-result-panel";
import { computeEstimate, type EstimateCalcInput } from "@/features/estimates/estimate-calc";
import {
  useCreateEstimate,
  useEstimateProducts,
  useUpdateEstimate,
} from "@/features/estimates/hooks";
import {
  useCostCatalog,
  useCostSubscriptions,
  useCostSummary,
  useFinanceSettings,
} from "@/features/finance/hooks";
import { LeadCombobox } from "@/features/leads/components/lead-combobox";
import { formatCurrency } from "@/utils/format";
import type {
  CostServiceCatalogItem,
  CostSubscription,
  CostSummary,
  EstimatePayload,
  EstimateStatus,
  FinanceSettings,
  PricingEstimate,
  ProjectProduct,
} from "@/types/api";

const DEFAULT_HOURS_LABELS = ["Design", "Frontend", "Backend", "SEO", "Testes"];
const MARGIN_PRESETS = [20, 30, 40];

/** Vírgula decimal -> ponto antes do z.coerce.number() -- o dono digita
 * "5,30" nos campos de dinheiro/horas/percentuais. Resolve aqui o que ficou
 * como backlog M3 da Fase 1 (cost-subscription-dialog não aceita vírgula). */
function parseDecimal(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return Number(trimmed.replace(",", "."));
  }
  return value;
}

function decimalField(min = 0, message = "Informe um número válido.") {
  return z.preprocess(parseDecimal, z.number({ invalid_type_error: message }).min(min, message));
}

function intField(min: number, max: number, message = "Informe um número válido.") {
  return z.preprocess(
    parseDecimal,
    z.number({ invalid_type_error: message }).int(message).min(min, message).max(max, message),
  );
}

function safeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.trim().replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

const hoursLineSchema = z.object({
  label: z.string().min(1, "Informe a etapa."),
  hours: decimalField(0, "Informe as horas."),
});

const costItemSchema = z.object({
  label: z.string().min(1, "Informe um nome."),
  amount: decimalField(0, "Informe um valor."),
  currency: z.enum(["BRL", "USD"]),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]),
  subscriptionId: z.string().nullable().optional(),
  /** Bookkeeping só de UI -- marca "adicionado via este checkbox" pra permitir
   * desmarcar sem tentar resincronizar com o que já veio do banco na edição
   * (cuidado explícito do brief da Task 6). Nunca vai pro payload da API. */
  originKey: z.string().optional(),
});

const schema = z.object({
  title: z.string().min(2, "Informe um título com pelo menos 2 caracteres."),
  leadId: z.string().optional(),
  productId: z.string().default("none"),
  hourlyRate: decimalField(0, "Informe o valor da hora."),
  hoursBreakdown: z.array(hoursLineSchema).min(1, "Adicione pelo menos uma etapa."),
  costItems: z.array(costItemSchema),
  agencyShareMonthly: decimalField(0, "Informe o rateio da agência."),
  infraMonths: intField(0, 60),
  supportReservePct: decimalField(0, "Informe a reserva."),
  marginPct: decimalField(0, "Informe a margem."),
  scopeText: z.string().optional(),
  deadlineDays: intField(1, 365, "Informe o prazo em dias."),
  paymentTerms: z.string().optional(),
  validDays: intField(1, 90, "Informe a validade em dias."),
});
type FormValues = z.infer<typeof schema>;

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Usado tanto por `/estimates/new` quanto por `/estimates/[id]` -- só recebe
 * `estimate` (ausente = criação). Busca settings/resumo de custos/assinaturas/
 * catálogo/produtos por conta própria e espera settings (e, se for orçamento
 * novo, o resumo de custos) carregarem antes de montar o form, pra os
 * defaultValues já nascerem certos sem useEffect + reset() correndo atrás do
 * carregamento das queries. */
export function EstimateEditor({ estimate }: { estimate?: PricingEstimate }) {
  const isEdit = !!estimate;
  const { data: settings } = useFinanceSettings();
  const { data: costSummary } = useCostSummary();
  const { data: subscriptions } = useCostSubscriptions();
  const { data: catalog } = useCostCatalog();
  const { data: products } = useEstimateProducts();

  const ready = !!settings && (isEdit || !!costSummary);
  if (!ready) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <div className="h-40 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <EstimateForm
      estimate={estimate}
      settings={settings}
      costSummary={costSummary}
      subscriptions={subscriptions ?? []}
      catalog={catalog ?? []}
      products={products ?? []}
    />
  );
}

function EstimateForm({
  estimate,
  settings,
  costSummary,
  subscriptions,
  catalog,
  products,
}: {
  estimate?: PricingEstimate;
  settings: FinanceSettings;
  costSummary?: CostSummary;
  subscriptions: CostSubscription[];
  catalog: CostServiceCatalogItem[];
  products: ProjectProduct[];
}) {
  const router = useRouter();
  const isEdit = !!estimate;
  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const pending = isEdit ? updateEstimate.isPending : createEstimate.isPending;

  const usdToBrlRate = Number(settings.usdToBrlRate);
  const clientSubscriptions = subscriptions.filter((s) => s.scope === "CLIENT" && s.isActive);

  const defaultValues: FormValues = estimate
    ? {
        title: estimate.title,
        leadId: estimate.leadId ?? undefined,
        productId: estimate.productId ?? "none",
        hourlyRate: Number(estimate.hourlyRate),
        hoursBreakdown: estimate.hoursBreakdown.length
          ? estimate.hoursBreakdown
          : DEFAULT_HOURS_LABELS.map((label) => ({ label, hours: 0 })),
        costItems: estimate.costItems.map((item) => ({
          label: item.label,
          amount: Number(item.amount),
          currency: item.currency,
          billingCycle: item.billingCycle,
          subscriptionId: item.subscriptionId,
        })),
        agencyShareMonthly: Number(estimate.agencyShareMonthly),
        infraMonths: estimate.infraMonths,
        supportReservePct: Number(estimate.supportReservePct),
        marginPct: Number(estimate.marginPct),
        scopeText: estimate.scopeItems.join("\n"),
        deadlineDays: estimate.deadlineDays,
        paymentTerms: estimate.paymentTerms,
        validDays: estimate.validDays,
      }
    : {
        title: "",
        leadId: undefined,
        productId: "none",
        hourlyRate: Number(settings.defaultHourlyRate),
        hoursBreakdown: DEFAULT_HOURS_LABELS.map((label) => ({ label, hours: 0 })),
        costItems: [],
        agencyShareMonthly: costSummary?.perClientShareBrl ?? 0,
        infraMonths: 12,
        supportReservePct: Number(settings.supportReservePct),
        marginPct: Number(settings.defaultMarginPct),
        scopeText: "",
        deadlineDays: 30,
        paymentTerms: "",
        validDays: 15,
      };

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const {
    fields: hourFields,
    append: appendHour,
    remove: removeHour,
  } = useFieldArray({ control, name: "hoursBreakdown" });

  const {
    fields: costFields,
    append: appendCost,
    remove: removeCost,
  } = useFieldArray({ control, name: "costItems" });

  const values = useWatch({ control });
  const productId = values.productId ?? "none";
  const selectedProduct = products.find((p) => p.id === productId);

  const calcInput: EstimateCalcInput = useMemo(
    () => ({
      hourlyRate: safeNumber(values.hourlyRate),
      hoursBreakdown: (values.hoursBreakdown ?? []).map((h) => ({
        label: h?.label ?? "",
        hours: safeNumber(h?.hours),
      })),
      costItems: (values.costItems ?? []).map((c) => ({
        amount: safeNumber(c?.amount),
        currency: c?.currency ?? "BRL",
        billingCycle: c?.billingCycle ?? "MONTHLY",
      })),
      agencyShareMonthly: safeNumber(values.agencyShareMonthly),
      infraMonths: safeNumber(values.infraMonths),
      supportReservePct: safeNumber(values.supportReservePct),
      marginPct: safeNumber(values.marginPct),
      usdToBrlRate,
    }),
    [values, usdToBrlRate],
  );
  const computed = useMemo(() => computeEstimate(calcInput), [calcInput]);

  function handleProductChange(id: string) {
    setValue("productId", id);
    if (id === "none") return;
    const currentHours = getValues("hoursBreakdown");
    if (currentHours.every((h) => !h.hours)) {
      setValue(
        "hoursBreakdown",
        DEFAULT_HOURS_LABELS.map((label) => ({ label, hours: 0 })),
      );
    }
    if (!getValues("hourlyRate")) {
      setValue("hourlyRate", Number(settings.defaultHourlyRate));
    }
  }

  function toggleSubscription(subscription: CostSubscription, checked: boolean) {
    const key = `subscription:${subscription.id}`;
    if (checked) {
      appendCost({
        label: subscription.name,
        amount: Number(subscription.amount),
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        subscriptionId: subscription.id,
        originKey: key,
      });
    } else {
      const idx = getValues("costItems").findIndex((c) => c.originKey === key);
      if (idx >= 0) removeCost(idx);
    }
  }

  function toggleCatalogItem(item: CostServiceCatalogItem, checked: boolean) {
    const key = `catalog:${item.key}`;
    if (checked) {
      appendCost({
        label: item.name,
        amount: Number(item.defaultAmount),
        currency: item.currency,
        billingCycle: item.billingCycle,
        subscriptionId: null,
        originKey: key,
      });
    } else {
      const idx = getValues("costItems").findIndex((c) => c.originKey === key);
      if (idx >= 0) removeCost(idx);
    }
  }

  function isChecked(key: string) {
    return (values.costItems ?? []).some((c) => c?.originKey === key);
  }

  async function submit(formValues: FormValues, status: EstimateStatus) {
    const payload: EstimatePayload = {
      title: formValues.title,
      leadId: formValues.leadId || null,
      productId: formValues.productId === "none" ? null : formValues.productId,
      hourlyRate: formValues.hourlyRate,
      hoursBreakdown: formValues.hoursBreakdown,
      costItems: formValues.costItems.map((item) => ({
        label: item.label,
        amount: item.amount,
        currency: item.currency,
        billingCycle: item.billingCycle,
        subscriptionId: item.subscriptionId ?? null,
      })),
      agencyShareMonthly: formValues.agencyShareMonthly,
      infraMonths: formValues.infraMonths,
      supportReservePct: formValues.supportReservePct,
      marginPct: formValues.marginPct,
      scopeItems: (formValues.scopeText ?? "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
      deadlineDays: formValues.deadlineDays,
      paymentTerms: formValues.paymentTerms ?? "",
      validDays: formValues.validDays,
      status,
    };

    if (isEdit) {
      await updateEstimate.mutateAsync({ id: estimate.id, payload });
    } else {
      const created = await createEstimate.mutateAsync(payload);
      router.push(`/estimates/${created.id}`);
    }
  }

  const saveDraft = handleSubmit((v) => submit(v, "DRAFT"));
  const markReady = handleSubmit((v) => submit(v, "READY"));

  return (
    <form onSubmit={saveDraft} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Dados gerais</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Título" htmlFor="estimate-title" error={errors.title?.message}>
              <Input id="estimate-title" {...register("title")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Lead (opcional)">
                <Controller
                  control={control}
                  name="leadId"
                  render={({ field }) => (
                    <LeadCombobox value={field.value} onChange={(id) => field.onChange(id)} />
                  )}
                />
              </Field>

              <Field label="Produto (opcional)">
                <Select value={productId} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum produto</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    Faixa do catálogo: {formatCurrency(selectedProduct.priceMin)}–
                    {formatCurrency(selectedProduct.priceMax)}
                  </p>
                )}
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Horas por etapa</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {errors.hoursBreakdown?.message && (
              <p className="text-xs text-destructive">{errors.hoursBreakdown.message}</p>
            )}
            {hourFields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <Field
                  label={index === 0 ? "Etapa" : undefined}
                  htmlFor={`hours-label-${index}`}
                  error={errors.hoursBreakdown?.[index]?.label?.message}
                >
                  <Input
                    id={`hours-label-${index}`}
                    placeholder="Etapa"
                    {...register(`hoursBreakdown.${index}.label`)}
                  />
                </Field>
                <Field
                  label={index === 0 ? "Horas" : undefined}
                  htmlFor={`hours-value-${index}`}
                  error={errors.hoursBreakdown?.[index]?.hours?.message}
                >
                  <Input
                    id={`hours-value-${index}`}
                    inputMode="decimal"
                    className="w-28"
                    {...register(`hoursBreakdown.${index}.hours`)}
                  />
                </Field>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover etapa"
                  onClick={() => removeHour(index)}
                  disabled={hourFields.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() => appendHour({ label: "", hours: 0 })}
            >
              <Plus className="h-4 w-4" /> Adicionar etapa
            </Button>
            <p className="text-xs text-muted-foreground">Total: {computed.totalHours}h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Infra do cliente</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(clientSubscriptions.length > 0 || catalog.length > 0) && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Marque pra adicionar como item de custo
                </p>
                {clientSubscriptions.map((subscription) => {
                  const key = `subscription:${subscription.id}`;
                  return (
                    <label
                      key={subscription.id}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={isChecked(key)}
                        onCheckedChange={(checked) =>
                          toggleSubscription(subscription, checked === true)
                        }
                      />
                      {subscription.name} —{" "}
                      {subscription.currency === "USD"
                        ? `US$ ${Number(subscription.amount).toFixed(2)}`
                        : formatCurrency(subscription.amount)}
                      {subscription.billingCycle === "YEARLY" ? "/ano" : "/mês"}
                    </label>
                  );
                })}
                {catalog.map((item) => {
                  const key = `catalog:${item.key}`;
                  return (
                    <label key={item.key} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={isChecked(key)}
                        onCheckedChange={(checked) => toggleCatalogItem(item, checked === true)}
                      />
                      {item.name} —{" "}
                      {item.currency === "USD"
                        ? `US$ ${Number(item.defaultAmount).toFixed(2)}`
                        : formatCurrency(item.defaultAmount)}
                      {item.billingCycle === "YEARLY" ? "/ano" : "/mês"}{" "}
                      <span className="text-xs text-muted-foreground">(catálogo)</span>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {costFields.map((field, index) => {
                const item = values.costItems?.[index];
                const origin = item?.subscriptionId
                  ? "Assinatura"
                  : item?.originKey?.startsWith("catalog:")
                    ? "Catálogo"
                    : "Avulso";
                return (
                  <div
                    key={field.id}
                    className="flex flex-wrap items-start gap-2 rounded-lg border border-border p-2"
                  >
                    <Field
                      label="Nome"
                      htmlFor={`cost-label-${index}`}
                      error={errors.costItems?.[index]?.label?.message}
                    >
                      <Input
                        id={`cost-label-${index}`}
                        className="w-40"
                        {...register(`costItems.${index}.label`)}
                      />
                    </Field>
                    <Field
                      label="Valor"
                      htmlFor={`cost-amount-${index}`}
                      error={errors.costItems?.[index]?.amount?.message}
                    >
                      <Input
                        id={`cost-amount-${index}`}
                        inputMode="decimal"
                        className="w-24"
                        {...register(`costItems.${index}.amount`)}
                      />
                    </Field>
                    <Field label="Moeda">
                      <Controller
                        control={control}
                        name={`costItems.${index}.currency`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BRL">BRL</SelectItem>
                              <SelectItem value="USD">USD</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Field label="Ciclo">
                      <Controller
                        control={control}
                        name={`costItems.${index}.billingCycle`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger className="w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MONTHLY">Mensal</SelectItem>
                              <SelectItem value="YEARLY">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </Field>
                    <Badge variant="secondary" className="mt-6">
                      {origin}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-5"
                      aria-label="Remover item de custo"
                      onClick={() => removeCost(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() =>
                appendCost({
                  label: "",
                  amount: 0,
                  currency: "BRL",
                  billingCycle: "MONTHLY",
                  subscriptionId: null,
                })
              }
            >
              <Plus className="h-4 w-4" /> Item avulso
            </Button>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Rateio da agência (mensal)"
                htmlFor="agency-share"
                hint={
                  costSummary
                    ? `${formatCurrency(costSummary.perClientShareBrl)} calculado hoje`
                    : undefined
                }
                error={errors.agencyShareMonthly?.message}
              >
                <Input id="agency-share" inputMode="decimal" {...register("agencyShareMonthly")} />
              </Field>
              <Field label="Meses de infra" htmlFor="infra-months" error={errors.infraMonths?.message}>
                <Input id="infra-months" inputMode="numeric" {...register("infraMonths")} />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Precificação</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field
              label="Reserva de suporte (%)"
              htmlFor="support-reserve"
              error={errors.supportReservePct?.message}
            >
              <Input id="support-reserve" inputMode="decimal" {...register("supportReservePct")} />
            </Field>

            <Field label="Margem (%)" htmlFor="margin-pct" error={errors.marginPct?.message}>
              <div className="flex items-center gap-2">
                {MARGIN_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={Number(values.marginPct) === preset ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => setValue("marginPct", preset)}
                  >
                    {preset}%
                  </Button>
                ))}
                <Input
                  id="margin-pct"
                  inputMode="decimal"
                  className="w-24"
                  {...register("marginPct")}
                />
              </div>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Escopo e condições</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field label="Escopo (1 item por linha)" htmlFor="scope-items">
              <Textarea id="scope-items" rows={5} {...register("scopeText")} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Prazo (dias)" htmlFor="deadline-days" error={errors.deadlineDays?.message}>
                <Input id="deadline-days" inputMode="numeric" {...register("deadlineDays")} />
              </Field>
              <Field label="Validade (dias)" htmlFor="valid-days" error={errors.validDays?.message}>
                <Input id="valid-days" inputMode="numeric" {...register("validDays")} />
              </Field>
              <Field label="Taxa horária (R$)" htmlFor="hourly-rate" error={errors.hourlyRate?.message}>
                <Input id="hourly-rate" inputMode="decimal" {...register("hourlyRate")} />
              </Field>
            </div>

            <Field label="Condições de pagamento" htmlFor="payment-terms">
              <Textarea id="payment-terms" rows={2} {...register("paymentTerms")} />
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Salvando…" : "Salvar rascunho"}
          </Button>
          <Button type="button" onClick={markReady} disabled={pending}>
            {pending ? "Salvando…" : "Marcar como pronto"}
          </Button>
        </div>
      </div>

      <EstimateResultPanel
        computed={computed}
        hourlyRate={calcInput.hourlyRate}
        infraMonths={calcInput.infraMonths}
        agencyShareMonthly={calcInput.agencyShareMonthly}
        product={selectedProduct}
      />
    </form>
  );
}
