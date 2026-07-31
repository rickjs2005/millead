"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Plus, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Progress } from "@/components/ui/progress";
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
import { Textarea } from "@/components/ui/textarea";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import {
  useCostSubscriptions,
  useCreateUsage,
  useDeleteUsage,
  useUsage,
  useUsageSummary,
} from "@/features/finance/hooks";
import { formatCurrency } from "@/utils/format";
import type { CostSubscription } from "@/types/api";

/** `usedAt` chega como meia-noite UTC ("YYYY-MM-DD" ancorado em UTC) --
 * formatar no fuso do browser (o `formatDate` global) vira o dia anterior em
 * fusos negativos (ex. America/Sao_Paulo, UTC-3). Fix local só pra esta
 * coluna: formata em UTC, igual o dia foi gravado. */
function formatDateUtc(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(date);
}

/** "YYYY-MM" do mês corrente em America/Sao_Paulo -- mesmo fuso usado pelo
 * backend (`currentMonthInTimeZone`) quando `month` não é enviado na query. */
function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/** "YYYY-MM-DD" de hoje em America/Sao_Paulo -- default do input de data do
 * dialog de lançamento. */
function todayInputValue(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, mo] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, mo! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(month: string): string {
  const [year, mo] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year!, mo! - 1, 1),
  );
}

/** Mesmo esquema de cores/limiares (≥80 atenção, ≥100 estourado) do
 * capacity-section.tsx (Fase 4) -- consistência visual entre as duas seções
 * de "uso vs. limite" do Centro de Custos. */
function usageStatus(pct: number) {
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

const usageSchema = z.object({
  subscriptionId: z.string().min(1, "Selecione a assinatura."),
  companyId: z.string().optional(),
  credits: z.coerce.number().int().min(1, "Informe ao menos 1 crédito."),
  usedAt: z.string().min(1, "Informe a data."),
  note: z.string().max(200).optional(),
});
type UsageFormValues = z.infer<typeof usageSchema>;

function CreateUsageDialog({ subscriptions }: { subscriptions: CostSubscription[] }) {
  const [open, setOpen] = useState(false);
  const createUsage = useCreateUsage();
  // Só assinaturas ativas com créditos inclusos -- sem isso, "quanto custou o
  // crédito" não tem como ser calculado (o preço unitário depende disso).
  const creditSubscriptions = subscriptions.filter((s) => s.isActive && !!s.creditsIncluded);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UsageFormValues>({
    resolver: zodResolver(usageSchema),
    defaultValues: {
      subscriptionId: creditSubscriptions[0]?.id ?? "",
      companyId: undefined,
      credits: 1,
      usedAt: todayInputValue(),
      note: "",
    },
  });

  async function onSubmit(values: UsageFormValues) {
    await createUsage.mutateAsync({
      subscriptionId: values.subscriptionId,
      companyId: values.companyId || null,
      credits: values.credits,
      usedAt: values.usedAt,
      note: values.note || null,
    });
    reset({
      subscriptionId: values.subscriptionId,
      companyId: undefined,
      credits: 1,
      usedAt: todayInputValue(),
      note: "",
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Lançar consumo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Lançar consumo</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usage-subscription">Assinatura</Label>
              <Controller
                control={control}
                name="subscriptionId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="usage-subscription">
                      <SelectValue placeholder="Selecione a assinatura" />
                    </SelectTrigger>
                    <SelectContent>
                      {creditSubscriptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.subscriptionId && (
                <p className="text-xs text-destructive">{errors.subscriptionId.message}</p>
              )}
              {creditSubscriptions.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre créditos inclusos numa assinatura ativa antes de lançar consumo.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Cliente (opcional)</Label>
              <Controller
                control={control}
                name="companyId"
                render={({ field }) => (
                  <CompanyCombobox value={field.value} onChange={(id) => field.onChange(id)} />
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usage-credits">Créditos</Label>
                <Input
                  id="usage-credits"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  {...register("credits")}
                />
                {errors.credits && <p className="text-xs text-destructive">{errors.credits.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="usage-date">Data</Label>
                <Input id="usage-date" type="date" {...register("usedAt")} />
                {errors.usedAt && <p className="text-xs text-destructive">{errors.usedAt.message}</p>}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="usage-note">Nota (opcional)</Label>
              <Textarea id="usage-note" rows={2} {...register("note")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createUsage.isPending || creditSubscriptions.length === 0}>
              {createUsage.isPending ? "Salvando…" : "Lançar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Seção de consumo de créditos do `/costs`, abaixo da capacidade (Fase 4).
 * Resumo do mês (barra usado/incluído por assinatura, cruzando `bySubscription`
 * do summary com as assinaturas ativas -- uma sem lançamento no mês entra
 * como "0 usados" em vez de sumir), consumo por cliente e a lista de
 * lançamentos com exclusão. */
export function CreditUsageSection() {
  const [month, setMonth] = useState(() => currentMonth());
  const { data: subscriptions } = useCostSubscriptions();
  const { data: summary, isLoading: loadingSummary } = useUsageSummary(month);
  const { data: entries, isLoading: loadingEntries, isError, refetch } = useUsage(month);
  const deleteUsage = useDeleteUsage();
  const { confirm, dialog } = useConfirmDialog();

  const creditSubscriptions = (subscriptions ?? []).filter((s) => s.isActive && !!s.creditsIncluded);
  const bySubscription = summary?.bySubscription ?? [];

  const usageRows = creditSubscriptions.map((sub) => {
    const match = bySubscription.find((b) => b.subscriptionId === sub.id);
    const used = match?.credits ?? 0;
    const included = sub.creditsIncluded ?? 0;
    const pct = included > 0 ? Math.round((used / included) * 100) : 0;
    return { id: sub.id, name: sub.name, used, included, pct, costBrl: match?.costBrl ?? 0 };
  });

  function subscriptionName(id: string) {
    return subscriptions?.find((s) => s.id === id)?.name ?? "—";
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Consumo de créditos</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-32 text-center text-sm font-medium capitalize">
            {formatMonthLabel(month)}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Próximo mês"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {loadingSummary ? (
          <Skeleton className="h-10 w-full" />
        ) : usageRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma assinatura ativa com créditos inclusos cadastrada.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {usageRows.map((row) => {
              const status = usageStatus(row.pct);
              return (
                <div key={row.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{row.name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">
                        {row.used}/{row.included} créditos · {row.pct}% · {formatCurrency(row.costBrl)}
                      </p>
                      {status ? <Badge variant={status.badgeVariant}>{status.label}</Badge> : null}
                    </div>
                  </div>
                  <Progress
                    value={Math.min(row.pct, 100)}
                    indicatorClassName={status?.indicatorClassName}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Por cliente</p>
          {(summary?.byClient ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consumo lançado neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(summary?.byClient ?? []).map((row) => (
                  <TableRow key={row.companyId ?? "none"}>
                    <TableCell>{row.companyName}</TableCell>
                    <TableCell>{row.credits}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.costBrl)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Lançamentos</p>
            <CreateUsageDialog subscriptions={subscriptions ?? []} />
          </div>

          {isError ? (
            <ErrorState onRetry={() => refetch()} className="border-none" />
          ) : loadingEntries ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (entries ?? []).length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhum lançamento neste mês"
              description="Registre o consumo de créditos por cliente."
              className="border-none py-10"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Assinatura</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entries ?? []).map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">{formatDateUtc(entry.usedAt)}</TableCell>
                    <TableCell>{subscriptionName(entry.subscriptionId)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.companyName ?? "Sem cliente"}
                    </TableCell>
                    <TableCell>{entry.credits}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.note ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir lançamento"
                        onClick={() =>
                          confirm({
                            title: "Excluir lançamento",
                            description:
                              "Tem certeza que deseja excluir este lançamento de consumo? Essa ação não pode ser desfeita.",
                            confirmLabel: "Excluir",
                            onConfirm: () => deleteUsage.mutateAsync(entry.id),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {dialog}
        </div>
      </CardContent>
    </Card>
  );
}
