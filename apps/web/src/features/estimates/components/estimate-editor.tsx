"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useConfirmDialog } from "@/components/confirm-dialog";
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
import { BriefingPicker } from "@/features/briefings/components/briefing-picker";
import { estimatePrefillFromBriefing } from "@/features/estimates/briefing-prefill";
import { EstimateResultPanel } from "@/features/estimates/components/estimate-result-panel";
import { computeEstimate, type EstimateCalcInput } from "@/features/estimates/estimate-calc";
import {
  useConvertEstimate,
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
import { useProposal } from "@/features/proposals/hooks";
import { formatCurrency } from "@/utils/format";
import type {
  CostServiceCatalogItem,
  CostSubscription,
  CostSummary,
  EstimatePayload,
  EstimateStatusWrite,
  FinanceSettings,
  PricingEstimate,
  ProjectProduct,
} from "@/types/api";

const DEFAULT_HOURS_LABELS = ["Design", "Frontend", "Backend", "SEO", "Testes"];
const MARGIN_PRESETS = [20, 30, 40];

/** Espelho local do mesmo helper em cost-subscription-dialog.tsx/
 * cost-subscriptions-list.tsx -- valor mensal em BRL de uma assinatura. */
function monthlyBrl(subscription: CostSubscription, rate: number) {
  const brl =
    subscription.currency === "USD" ? Number(subscription.amount) * rate : Number(subscription.amount);
  return subscription.billingCycle === "YEARLY" ? brl / 12 : brl;
}

/** Extrai o N de créditos do label auto-gerado "{nome} (N créditos)" --
 * fonte da verdade pro valor exibido no input (evita arredondar de volta
 * a partir do amount, que teria erro de ponto flutuante). */
function parseCreditsFromLabel(label: string): number {
  const match = label.match(/\((\d+) créditos\)$/);
  return match ? Number(match[1]) : 0;
}

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

/** Mesmo preprocess vírgula-decimal, mas o campo pode ficar vazio -- usado no
 * "Preço final (você decide)": ausente equivale a "usar o recomendado" (a
 * API resolve essa cascata no convert). */
function optionalDecimalField(min = 0, message = "Informe um valor válido.") {
  return z.preprocess(
    parseDecimal,
    z.number({ invalid_type_error: message }).min(min, message).optional(),
  );
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
  // Custo único (créditos estimados) -- ausente equivale a false. Sempre
  // MONTHLY quando true (o DTO da API rejeita outra combinação).
  isOneTime: z.boolean().optional(),
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
  // Fase 6: preço final decidido pelo dono -- ausente usa o recomendado (a
  // API resolve a cascata no convert). "Tocado" (digitado ou preset clicado)
  // é controlado fora do schema, por um ref (ver `finalPriceTouchedRef`).
  finalPrice: optionalDecimalField(0),
  // Domínio .br por N anos -- 0 = "Nenhum" (nasce sempre presente e nunca
  // fica undefined, ao contrário de finalPrice, pra o <Select> sempre ter um
  // valor controlado). `domainYearPriceBrl` é o snapshot do preço/ano do
  // catálogo NO MOMENTO da seleção (nunca digitado -- setado junto com
  // `domainYears` no handler do select).
  domainYears: z.number().int().min(0).max(3).default(0),
  domainYearPriceBrl: z.number().min(0).default(0),
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
export function EstimateEditor({
  estimate,
  defaultLeadId,
}: {
  estimate?: PricingEstimate;
  /** Pré-seleciona o lead em orçamento novo criado a partir do detalhe de um
   * lead (`/estimates/new?leadId=...`, unificação da Fase 6). Ignorado em
   * edição -- o `leadId` já persistido manda. */
  defaultLeadId?: string;
}) {
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
      defaultLeadId={defaultLeadId}
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
  defaultLeadId,
  settings,
  costSummary,
  subscriptions,
  catalog,
  products,
}: {
  estimate?: PricingEstimate;
  defaultLeadId?: string;
  settings: FinanceSettings;
  costSummary?: CostSummary;
  subscriptions: CostSubscription[];
  catalog: CostServiceCatalogItem[];
  products: ProjectProduct[];
}) {
  const router = useRouter();
  const isEdit = !!estimate;
  const isConverted = estimate?.status === "CONVERTED";
  const createEstimate = useCreateEstimate();
  const updateEstimate = useUpdateEstimate();
  const convertEstimate = useConvertEstimate();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const pending = isEdit ? updateEstimate.isPending : createEstimate.isPending;
  // Proposal buscada pelo proposalId já presente no PricingEstimate (decisão
  // da Task 3: reusar proposalsService.get em vez de inflar o GET do
  // estimate no back com um include de proposal -- zero mudança de backend).
  const { data: proposal } = useProposal(isConverted ? estimate.proposalId : null);

  const usdToBrlRate = Number(settings.usdToBrlRate);
  const clientSubscriptions = subscriptions.filter((s) => s.scope === "CLIENT" && s.isActive);
  // Sem filtro de escopo -- créditos (ex.: Higgsfield) normalmente são AGENCY
  // (plano único compartilhado), mas o consumo por projeto ainda é estimável.
  const creditSubscriptions = subscriptions.filter((s) => s.isActive && !!s.creditsIncluded);

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
          isOneTime: item.isOneTime,
        })),
        agencyShareMonthly: Number(estimate.agencyShareMonthly),
        infraMonths: estimate.infraMonths,
        supportReservePct: Number(estimate.supportReservePct),
        marginPct: Number(estimate.marginPct),
        scopeText: estimate.scopeItems.join("\n"),
        deadlineDays: estimate.deadlineDays,
        paymentTerms: estimate.paymentTerms,
        validDays: estimate.validDays,
        finalPrice: estimate.finalPrice != null ? Number(estimate.finalPrice) : undefined,
        domainYears: estimate.domainYears ?? 0,
        domainYearPriceBrl: estimate.domainYearPriceBrl != null ? Number(estimate.domainYearPriceBrl) : 0,
      }
    : {
        title: "",
        leadId: defaultLeadId,
        productId: "none",
        hourlyRate: Number(settings.defaultHourlyRate),
        hoursBreakdown: DEFAULT_HOURS_LABELS.map((label) => ({ label, hours: 0 })),
        costItems: [],
        // Rateio nasce zerado (decisão do Rick) -- o valor calculado hoje só
        // aparece como sugestão (hint + botão "Usar" no campo abaixo).
        agencyShareMonthly: 0,
        infraMonths: 12,
        supportReservePct: Number(settings.supportReservePct),
        marginPct: Number(settings.defaultMarginPct),
        scopeText: "",
        deadlineDays: 30,
        paymentTerms: "",
        validDays: 15,
        finalPrice: undefined,
        domainYears: 0,
        domainYearPriceBrl: 0,
      };

  const {
    control,
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isDirty },
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
        isOneTime: c?.isOneTime ?? false,
      })),
      agencyShareMonthly: safeNumber(values.agencyShareMonthly),
      infraMonths: safeNumber(values.infraMonths),
      supportReservePct: safeNumber(values.supportReservePct),
      marginPct: safeNumber(values.marginPct),
      usdToBrlRate,
      // `domainYears` 0 (select em "Nenhum") vira null pro cálculo (mesmo
      // efeito -- (domainYears ?? 0) × preço -- mas null é o shape que o
      // resto do domínio (payload, PDF) usa pra "sem domínio").
      domainYears: values.domainYears ? safeNumber(values.domainYears) : null,
      domainYearPriceBrl: safeNumber(values.domainYearPriceBrl),
    }),
    [values, usdToBrlRate],
  );
  const computed = useMemo(() => computeEstimate(calcInput), [calcInput]);

  // Catálogo `registrobr-domain` -- preço/ano exibido nas opções do select de
  // domínio e snapshotado em `domainYearPriceBrl` quando o dono escolhe uma
  // opção (fallback 40 se o catálogo não tiver o item, ex.: seed ausente).
  const domainYearPrice = useMemo(() => {
    const item = catalog.find((c) => c.key === "registrobr-domain");
    return item ? Number(item.defaultAmount) : 40;
  }, [catalog]);

  function handleDomainYearsChange(years: number) {
    setValue("domainYears", years, { shouldDirty: true });
    setValue("domainYearPriceBrl", years > 0 ? domainYearPrice : 0, { shouldDirty: true });
  }

  // Preço final (Fase 6): pré-preenche com o recomendado em orçamento NOVO
  // enquanto o dono não mexeu no campo (nem digitou, nem clicou um preset) --
  // `touchedRef` (não state) porque não precisa re-render, só precisa ser
  // lido dentro do efeito abaixo a cada recálculo do `computed`. Em edição
  // (`isEdit`) nunca mexe -- o valor salvo (ou vazio) é a fonte da verdade.
  const finalPriceTouchedRef = useRef(isEdit);
  useEffect(() => {
    if (finalPriceTouchedRef.current) return;
    const recommended = computed.priceRecommended;
    if (recommended > 0) {
      setValue("finalPrice", Math.round(recommended * 100) / 100);
    }
  }, [computed.priceRecommended, setValue]);

  function setFinalPricePreset(price: number) {
    finalPriceTouchedRef.current = true;
    setValue("finalPrice", Math.round(price * 100) / 100, { shouldDirty: true });
  }

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

  // O estado "marcado" de cada checkbox é sempre derivado dos `costItems`
  // atuais (por subscriptionId pra assinaturas, por label pra itens de
  // catálogo) -- nunca de um estado de UI à parte. Isso vale tanto pra
  // orçamento novo quanto pra edição: se o item já veio carregado do banco
  // com aquele subscriptionId, a caixa já nasce marcada, e desmarcar remove
  // essa linha (nunca duplica). Correção pós-revisão da Task 6.
  // `!c?.isOneTime` exclui a linha de créditos estimados (mesmo
  // subscriptionId, isOneTime true) -- do contrário, estimar créditos de uma
  // assinatura marcaria essa caixa como "recorrente adicionado" por engano.
  function isSubscriptionChecked(subscriptionId: string) {
    return (values.costItems ?? []).some((c) => c?.subscriptionId === subscriptionId && !c?.isOneTime);
  }

  function toggleSubscription(subscription: CostSubscription, checked: boolean) {
    if (checked) {
      if (isSubscriptionChecked(subscription.id)) return;
      appendCost({
        label: subscription.name,
        amount: Number(subscription.amount),
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        subscriptionId: subscription.id,
      });
    } else {
      const idx = getValues("costItems").findIndex(
        (c) => c.subscriptionId === subscription.id && !c.isOneTime,
      );
      if (idx >= 0) removeCost(idx);
    }
  }

  // Estimador de créditos (Fase 5): cada assinatura ativa com creditsIncluded
  // ganha um input próprio que cria/atualiza/remove UMA linha isOneTime em
  // costItems (identificada por subscriptionId + isOneTime, coexiste com a
  // linha recorrente da mesma assinatura, se houver). O preço unitário é
  // sempre derivado (nunca digitado) -- muda o plano/câmbio, muda o unitário.
  function creditsLineIndex(subscriptionId: string) {
    return (values.costItems ?? []).findIndex(
      (c) => c?.subscriptionId === subscriptionId && c?.isOneTime,
    );
  }

  function creditsLineValue(subscriptionId: string): number {
    const idx = creditsLineIndex(subscriptionId);
    if (idx < 0) return 0;
    return parseCreditsFromLabel(values.costItems?.[idx]?.label ?? "");
  }

  function setCreditsLine(subscription: CostSubscription, credits: number) {
    const idx = creditsLineIndex(subscription.id);
    const included = subscription.creditsIncluded ?? 1;
    const unit = monthlyBrl(subscription, usdToBrlRate) / included;

    if (!credits || credits <= 0) {
      if (idx >= 0) removeCost(idx);
      return;
    }

    const label = `${subscription.name} (${credits} créditos)`;
    // Arredonda pra 2 casas -- sem isso, 300 × 0,239 aparece como
    // 71.69999999999999 no campo Valor (erro de ponto flutuante).
    const amount = Math.round(credits * unit * 100) / 100;
    if (idx >= 0) {
      setValue(`costItems.${idx}.label`, label);
      setValue(`costItems.${idx}.amount`, amount);
    } else {
      appendCost({
        label,
        amount,
        currency: "BRL",
        billingCycle: "MONTHLY",
        subscriptionId: subscription.id,
        isOneTime: true,
      });
    }
  }

  // Itens de catálogo não têm uma chave estável no snapshot persistido
  // (`EstimateCostItem` só guarda label/amount/currency/billingCycle) --
  // "nome de catálogo" não é único (dois itens podem ter o mesmo nome, ou um
  // avulso pode coincidir com um nome de catálogo), então um checkbox
  // sincronizado por label dá falso-marcado e remove a linha errada. Por
  // isso isto é um botão "Adicionar" (sem estado marcado): clicar sempre
  // adiciona uma linha nova, e só fica desabilitado como guarda anti-duplo-
  // clique quando já existe uma linha SEM subscriptionId idêntica em
  // label+amount+currency+billingCycle. Remover é sempre feito na própria
  // linha da lista de custItems (nunca por aqui). Correção pós-revisão.
  function isCatalogItemAdded(item: CostServiceCatalogItem) {
    return (values.costItems ?? []).some(
      (c) =>
        !c?.subscriptionId &&
        c?.label === item.name &&
        Number(c?.amount ?? NaN) === Number(item.defaultAmount) &&
        c?.currency === item.currency &&
        c?.billingCycle === item.billingCycle,
    );
  }

  function addCatalogItem(item: CostServiceCatalogItem) {
    if (isCatalogItemAdded(item)) return;
    appendCost({
      label: item.name,
      amount: Number(item.defaultAmount),
      currency: item.currency,
      billingCycle: item.billingCycle,
      subscriptionId: null,
    });
  }

  async function submit(formValues: FormValues, status: EstimateStatusWrite) {
    const payload: EstimatePayload = {
      title: formValues.title,
      leadId: formValues.leadId || null,
      productId: formValues.productId === "none" ? null : formValues.productId,
      hourlyRate: formValues.hourlyRate,
      hoursBreakdown: formValues.hoursBreakdown,
      costItems: formValues.costItems.map((item) => ({
        label: item.label,
        amount: item.amount,
        // Custo único é sempre MONTHLY -- o DTO da API rejeita isOneTime com
        // outro ciclo (item não tem seletor de ciclo na UI, ver acima).
        currency: item.currency,
        billingCycle: item.isOneTime ? "MONTHLY" : item.billingCycle,
        subscriptionId: item.subscriptionId ?? null,
        isOneTime: item.isOneTime ?? false,
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
      // Fase 6: `null` explícito (nunca omitido) -- limpa o campo no update
      // quando o dono apaga o preço final ou volta o domínio pra "Nenhum".
      finalPrice: formValues.finalPrice || null,
      domainYears: formValues.domainYears > 0 ? formValues.domainYears : null,
      domainYearPriceBrl: formValues.domainYears > 0 ? formValues.domainYearPriceBrl : null,
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

  // Conversão direta (Fase 6): sem dialog de escolha de preço -- só confirma
  // o que a API vai usar (finalPrice salvo, ou recomendado na ausência) e
  // dispara `convert(id)` sem body de price. Só chamável com `estimate`
  // existente (botão só aparece com `isEdit`, ver JSX abaixo).
  function openConvertConfirm() {
    if (!estimate) return;
    const priceToUse =
      estimate.finalPrice != null ? Number(estimate.finalPrice) : computed.priceRecommended;
    confirm({
      title: "Gerar proposta",
      description: `Será criada uma proposta em rascunho com PDF de ${formatCurrency(priceToUse)} para o cliente. Custos internos não aparecem no PDF.`,
      confirmLabel: "Gerar proposta",
      variant: "default",
      onConfirm: async () => {
        await convertEstimate.mutateAsync(estimate.id);
      },
    });
  }

  // Prefill do briefing (só orçamento novo): título = nome da empresa,
  // lead = o vinculado ao briefing, escopo = objetivos/funcionalidades
  // marcados pelo cliente. Horas/custos/preço seguem manuais — decisão do
  // dono, não resposta de cliente.
  function applyBriefing(detail: Parameters<typeof estimatePrefillFromBriefing>[0]) {
    const prefill = estimatePrefillFromBriefing(detail);
    if (prefill.title) setValue("title", prefill.title, { shouldValidate: true, shouldDirty: true });
    if (prefill.leadId) setValue("leadId", prefill.leadId, { shouldDirty: true });
    if (prefill.scopeText) setValue("scopeText", prefill.scopeText, { shouldDirty: true });
  }

  return (
    <form onSubmit={saveDraft} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        {!isEdit && (
          <BriefingPicker
            onDetail={applyBriefing}
            hint="Preenche título, lead e escopo com o que o cliente respondeu. Revise antes de salvar."
          />
        )}
        {isConverted && (
          <Card className="border-success/50 bg-success/5">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Convertido em proposta</p>
                <p className="text-sm text-muted-foreground">
                  Este orçamento foi convertido e agora é somente leitura.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/proposals">Ver proposta</Link>
                </Button>
                {proposal?.pdfUrl && (
                  <Button asChild size="sm">
                    <a href={proposal.pdfUrl} target="_blank" rel="noreferrer">
                      Abrir PDF
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* fieldset nativo: disabled cascateia pra todo input/select/button
            descendente (inclusive os componentes Radix -- Select/Checkbox
            renderizam <button> por baixo), sem precisar espalhar `disabled`
            campo a campo por todos os Cards abaixo. */}
        <fieldset disabled={isConverted} className="m-0 flex flex-col gap-4 border-0 p-0">
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
            {clientSubscriptions.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Assinaturas do cliente — marque pra adicionar como item de custo
                </p>
                {clientSubscriptions.map((subscription) => (
                  <label
                    key={subscription.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={isSubscriptionChecked(subscription.id)}
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
                ))}
              </div>
            )}

            {catalog.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Catálogo de serviços — adiciona uma linha nova a cada clique
                </p>
                {catalog.map((item) => {
                  const added = isCatalogItemAdded(item);
                  return (
                    <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {item.name} —{" "}
                        {item.currency === "USD"
                          ? `US$ ${Number(item.defaultAmount).toFixed(2)}`
                          : formatCurrency(item.defaultAmount)}
                        {item.billingCycle === "YEARLY" ? "/ano" : "/mês"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1"
                        disabled={added}
                        onClick={() => addCatalogItem(item)}
                      >
                        <Plus className="h-3.5 w-3.5" /> {added ? "Adicionado" : "Adicionar"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {creditSubscriptions.length > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Créditos estimados — custo único, não entra no × meses de infra
                </p>
                {creditSubscriptions.map((subscription) => {
                  const included = subscription.creditsIncluded ?? 1;
                  const unit = monthlyBrl(subscription, usdToBrlRate) / included;
                  const credits = creditsLineValue(subscription.id);
                  return (
                    <div key={subscription.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1">Créditos {subscription.name}:</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        className="w-24"
                        value={credits || ""}
                        placeholder="0"
                        onChange={(e) => setCreditsLine(subscription, Number(e.target.value) || 0)}
                        aria-label={`Créditos estimados de ${subscription.name}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        × {formatCurrency(unit)} = {formatCurrency(credits * unit)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {costFields.map((field, index) => {
                const item = values.costItems?.[index];
                const origin = item?.isOneTime ? "único" : item?.subscriptionId ? "Assinatura" : "Avulso";
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
                    {/* Custo único não tem ciclo (a API rejeita isOneTime+YEARLY) --
                        esconder em vez de deixar um seletor que quebraria a gravação. */}
                    {!item?.isOneTime && (
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
                    )}
                    <Badge variant={item?.isOneTime ? "outline" : "secondary"} className="mt-6">
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
                error={errors.agencyShareMonthly?.message}
              >
                <Input id="agency-share" inputMode="decimal" {...register("agencyShareMonthly")} />
                {/* Orçamento novo nasce com rateio 0 (decisão do Rick) -- este
                    é só um atalho pra puxar o valor calculado hoje, não um
                    auto-fill. */}
                {costSummary && (
                  <p className="text-xs text-muted-foreground">
                    Rateio calculado hoje: {formatCurrency(costSummary.perClientShareBrl)}
                    {" — "}
                    <button
                      type="button"
                      className="font-medium text-primary hover:underline"
                      onClick={() => setValue("agencyShareMonthly", costSummary.perClientShareBrl)}
                    >
                      Usar
                    </button>
                  </p>
                )}
              </Field>
              <Field label="Meses de infra" htmlFor="infra-months" error={errors.infraMonths?.message}>
                <Input id="infra-months" inputMode="numeric" {...register("infraMonths")} />
              </Field>
            </div>

            <Field label="Domínio .br (Registro.br)">
              <Select
                value={String(values.domainYears ?? 0)}
                onValueChange={(v) => handleDomainYearsChange(Number(v))}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Nenhum</SelectItem>
                  <SelectItem value="1">1 ano — {formatCurrency(domainYearPrice)}</SelectItem>
                  <SelectItem value="2">2 anos — {formatCurrency(domainYearPrice * 2)}</SelectItem>
                  <SelectItem value="3">3 anos — {formatCurrency(domainYearPrice * 3)}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
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
        </fieldset>

        {!isConverted && (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button type="button" onClick={markReady} disabled={pending}>
              {pending ? "Salvando…" : "Marcar como pronto"}
            </Button>
            {isEdit && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5"
                  disabled={isDirty || !estimate.leadId || convertEstimate.isPending}
                  title={isDirty ? "Salve o orçamento antes de gerar a proposta." : undefined}
                  onClick={openConvertConfirm}
                >
                  <FileText className="h-4 w-4" />
                  {convertEstimate.isPending ? "Gerando…" : "Gerar proposta"}
                </Button>
                {isDirty ? (
                  <span className="text-xs text-muted-foreground">
                    Salve o orçamento antes de gerar a proposta.
                  </span>
                ) : !estimate.leadId ? (
                  <span className="text-xs text-muted-foreground">
                    Vincule um lead pra habilitar a conversão em proposta.
                  </span>
                ) : null}
                {confirmDialog}
              </>
            )}
          </div>
        )}
      </div>

      <EstimateResultPanel
        computed={computed}
        hourlyRate={calcInput.hourlyRate}
        infraMonths={calcInput.infraMonths}
        agencyShareMonthly={calcInput.agencyShareMonthly}
        domainYears={calcInput.domainYears ?? 0}
        product={selectedProduct}
      >
        {!isConverted && (
          <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
            <Field
              label="Preço final (você decide)"
              htmlFor="final-price"
              hint="Pré-preenchido com o recomendado -- ajuste livremente ou use um preset."
              error={errors.finalPrice?.message}
            >
              <Input
                id="final-price"
                inputMode="decimal"
                {...register("finalPrice", {
                  onChange: () => {
                    finalPriceTouchedRef.current = true;
                  },
                })}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFinalPricePreset(computed.priceMin)}
              >
                Mínimo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFinalPricePreset(computed.priceRecommended)}
              >
                Recomendado
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFinalPricePreset(computed.pricePremium)}
              >
                Premium
              </Button>
            </div>
          </div>
        )}
      </EstimateResultPanel>
    </form>
  );
}
