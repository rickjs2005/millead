"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCreatePlan } from "@/features/receivables/hooks";
import { formatCurrency } from "@/utils/format";

/** "YYYY-MM-DD" de hoje no fuso local -- default dos inputs de data. Não
 * precisa de America/Sao_Paulo aqui (diferente do usedAt de custos): esses
 * vencimentos são date-only escolhidos pelo usuário, não um instante gravado. */
function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Espelho de `addMonthsClamped` em
 * `apps/api/src/application/services/receivable-plan.ts` -- soma `months` a
 * `date` preservando o dia do mês; quando o mês destino é mais curto, usa o
 * ÚLTIMO dia daquele mês. Opera em UTC porque as datas aqui são date-only
 * ("YYYY-MM-DD" sem hora); misturar com o fuso do browser arrastaria o
 * resultado pro dia errado. */
function addMonthsClampedUtc(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, daysInTargetMonth));
  return target;
}

function toDateOnlyString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface InstallmentPreview {
  amount: number;
  dueDate: string;
}

/** Espelho de `buildPlan` em `apps/api/src/application/services/receivable-plan.ts`
 * -- divide (total - entrada) em N parcelas iguais em CENTAVOS INTEIROS, com o
 * resto de arredondamento jogado na ÚLTIMA parcela (evita drift de ponto
 * flutuante). Este preview é só visual; a API roda a MESMA regra de novo e
 * valida a soma no servidor -- se um dia o algoritmo mudar lá, precisa mudar
 * aqui também. */
function buildInstallmentsPreview(params: {
  total: number;
  entryAmount: number;
  installmentCount: number;
  firstDueDate: string;
}): InstallmentPreview[] {
  const { total, entryAmount, installmentCount, firstDueDate } = params;
  if (installmentCount < 1 || !firstDueDate || total <= 0) return [];

  const totalCents = Math.round(total * 100);
  const entryCents = Math.round(entryAmount * 100);
  const remainingCents = totalCents - entryCents;
  if (remainingCents < 0) return [];

  const perInstallmentCents = Math.floor(remainingCents / installmentCount);
  const lastCents = remainingCents - perInstallmentCents * (installmentCount - 1);
  const firstDate = new Date(`${firstDueDate}T00:00:00Z`);

  return Array.from({ length: installmentCount }, (_, i) => {
    const isLast = i === installmentCount - 1;
    const amountCents = isLast ? lastCents : perInstallmentCents;
    return {
      amount: amountCents / 100,
      dueDate: toDateOnlyString(addMonthsClampedUtc(firstDate, i)),
    };
  });
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

const schema = z
  .object({
    total: z.coerce.number().positive("Informe um total válido."),
    entryAmount: z.coerce.number().min(0, "Informe um valor válido."),
    entryDueDate: z.string().min(1, "Informe o vencimento da entrada."),
    installmentCount: z.coerce
      .number()
      .int()
      .min(1, "Informe ao menos 1 parcela.")
      .max(60, "Máximo de 60 parcelas."),
    firstDueDate: z.string().min(1, "Informe o vencimento da 1ª parcela."),
  })
  .refine((v) => v.entryAmount <= v.total, {
    message: "A entrada não pode ser maior que o total.",
    path: ["entryAmount"],
  });
type FormValues = z.infer<typeof schema>;

/** Dialog de "Definir plano" no detalhe do contrato -- entrada (R$, campo
 * único; % fica pro usuário calcular, YAGNI) + N parcelas iguais a partir de
 * um 1º vencimento. Mostra o preview da distribuição antes de salvar; ajuste
 * fino de valor/vencimento por parcela é feito depois, na tabela do card
 * (PATCH por parcela) -- não aqui. */
export function PlanDialog({
  contractId,
  valorTotal,
  trigger,
}: {
  contractId: string;
  valorTotal: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createPlan = useCreatePlan();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      total: Number(valorTotal),
      entryAmount: 0,
      entryDueDate: todayInputValue(),
      installmentCount: 1,
      firstDueDate: todayInputValue(),
    },
  });

  const total = watch("total");
  const entryAmount = watch("entryAmount");
  const installmentCount = watch("installmentCount");
  const firstDueDate = watch("firstDueDate");

  const preview = buildInstallmentsPreview({
    total: Number(total || 0),
    entryAmount: Number(entryAmount || 0),
    installmentCount: Number(installmentCount || 0),
    firstDueDate,
  });
  const previewSum = Number(entryAmount || 0) + preview.reduce((acc, i) => acc + i.amount, 0);

  async function onSubmit(values: FormValues) {
    const installments = buildInstallmentsPreview({
      total: values.total,
      entryAmount: values.entryAmount,
      installmentCount: values.installmentCount,
      firstDueDate: values.firstDueDate,
    });
    await createPlan.mutateAsync({
      contractId,
      total: values.total,
      entryAmount: values.entryAmount,
      entryDueDate: values.entryDueDate,
      installments,
    });
    reset({
      total: values.total,
      entryAmount: 0,
      entryDueDate: todayInputValue(),
      installmentCount: 1,
      firstDueDate: todayInputValue(),
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Definir plano de recebimento</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="plan-total">Valor total</Label>
              <Input id="plan-total" inputMode="decimal" {...register("total")} />
              {errors.total && <p className="text-xs text-destructive">{errors.total.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-entry-amount">Entrada (R$)</Label>
                <Input id="plan-entry-amount" inputMode="decimal" {...register("entryAmount")} />
                {errors.entryAmount && (
                  <p className="text-xs text-destructive">{errors.entryAmount.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-entry-due-date">Vencimento da entrada</Label>
                <Input id="plan-entry-due-date" type="date" {...register("entryDueDate")} />
                {errors.entryDueDate && (
                  <p className="text-xs text-destructive">{errors.entryDueDate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-installment-count">Nº de parcelas</Label>
                <Input
                  id="plan-installment-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={60}
                  {...register("installmentCount")}
                />
                {errors.installmentCount && (
                  <p className="text-xs text-destructive">{errors.installmentCount.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="plan-first-due-date">1º vencimento</Label>
                <Input id="plan-first-due-date" type="date" {...register("firstDueDate")} />
                {errors.firstDueDate && (
                  <p className="text-xs text-destructive">{errors.firstDueDate.message}</p>
                )}
              </div>
            </div>

            {preview.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label>Prévia da distribuição</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Number(entryAmount || 0) > 0 && (
                      <TableRow>
                        <TableCell>Entrada</TableCell>
                        <TableCell>
                          {watch("entryDueDate") ? formatDateOnly(watch("entryDueDate")) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(entryAmount))}
                        </TableCell>
                      </TableRow>
                    )}
                    {preview.map((installment, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{formatDateOnly(installment.dueDate)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(installment.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground">
                  Soma da prévia: {formatCurrency(previewSum)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createPlan.isPending}>
              {createPlan.isPending ? "Salvando…" : "Criar plano"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
