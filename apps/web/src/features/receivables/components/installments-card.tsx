"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, HandCoins, Pencil, Trash2, Undo2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PlanDialog } from "@/features/receivables/components/plan-dialog";
import {
  useContractMargin,
  useDeleteReceivable,
  usePayReceivable,
  useReceivablesByContract,
  useUnpayReceivable,
  useUpdateReceivable,
} from "@/features/receivables/hooks";
import { formatCurrency } from "@/utils/format";
import type { ContractStatus, Receivable } from "@/types/api";

/** `dueDate` chega date-only ("YYYY-MM-DD" ancorado em UTC) -- formatar no
 * fuso do browser viraria o dia anterior em fusos negativos (mesmo gotcha do
 * `usedAt` em credit-usage-section.tsx). */
function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
    new Date(value),
  );
}

/** `paidAt` é um INSTANTE (não date-only) -- exibir no fuso do escritório
 * (America/Sao_Paulo), não em UTC. */
function formatPaidAt(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

type ReceivableStatus = "PAGA" | "VENCIDA" | "ABERTO";

/** Mesmo critério do `ReceivableService.summary` na API (`row.dueDate < now`,
 * comparação de instante) -- mantém a badge consistente com o que o resumo
 * financeiro considera "vencida". */
function receivableStatus(r: Receivable): ReceivableStatus {
  if (r.paidAt) return "PAGA";
  return new Date(r.dueDate) < new Date() ? "VENCIDA" : "ABERTO";
}

const STATUS_LABELS: Record<ReceivableStatus, string> = {
  PAGA: "Paga",
  VENCIDA: "Vencida",
  ABERTO: "Em aberto",
};

const STATUS_VARIANTS: Record<ReceivableStatus, "success" | "destructive" | "secondary"> = {
  PAGA: "success",
  VENCIDA: "destructive",
  ABERTO: "secondary",
};

function installmentLabel(r: Receivable): string {
  return r.kind === "ENTRADA" ? "Entrada" : `Parcela ${r.installmentIndex}`;
}

const payNoteSchema = z.object({ paidNote: z.string().max(500).optional() });
type PayNoteValues = z.infer<typeof payNoteSchema>;

function PayDialog({ receivable, trigger }: { receivable: Receivable; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pay = usePayReceivable();
  const { register, handleSubmit, reset } = useForm<PayNoteValues>({
    resolver: zodResolver(payNoteSchema),
    defaultValues: { paidNote: "" },
  });

  async function onSubmit(values: PayNoteValues) {
    await pay.mutateAsync({
      id: receivable.id,
      payload: { paidNote: values.paidNote || undefined },
    });
    reset({ paidNote: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Baixar {installmentLabel(receivable).toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-4">
            <Label htmlFor="pay-note">Nota (opcional)</Label>
            <Textarea id="pay-note" rows={2} {...register("paidNote")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pay.isPending}>
              {pay.isPending ? "Baixando…" : "Confirmar baixa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const editSchema = z.object({
  amount: z.coerce.number().positive("Informe um valor válido."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});
type EditValues = z.infer<typeof editSchema>;

function EditDialog({ receivable, trigger }: { receivable: Receivable; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateReceivable();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { amount: Number(receivable.amount), dueDate: receivable.dueDate.slice(0, 10) },
  });

  async function onSubmit(values: EditValues) {
    await update.mutateAsync({
      id: receivable.id,
      payload: { amount: values.amount, dueDate: values.dueDate },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Editar {installmentLabel(receivable).toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-amount">Valor</Label>
              <Input id="edit-amount" inputMode="decimal" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-due-date">Vencimento</Label>
              <Input id="edit-due-date" type="date" {...register("dueDate")} />
              {errors.dueDate && (
                <p className="text-xs text-destructive">{errors.dueDate.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceivableRow({ receivable }: { receivable: Receivable }) {
  const status = receivableStatus(receivable);
  const unpay = useUnpayReceivable();
  const deleteReceivable = useDeleteReceivable();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <TableRow>
      <TableCell>{installmentLabel(receivable)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDueDate(receivable.dueDate)}</TableCell>
      <TableCell>{formatCurrency(receivable.amount)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {receivable.paidAt ? formatPaidAt(receivable.paidAt) : "—"}
        {receivable.paidNote && (
          <span className="block text-xs italic text-muted-foreground">{receivable.paidNote}</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {status === "PAGA" ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Desfazer baixa de ${installmentLabel(receivable)}`}
              disabled={unpay.isPending}
              onClick={() =>
                confirm({
                  title: "Desfazer baixa",
                  description: `Desfazer a baixa desta parcela (${installmentLabel(receivable)})? Ela volta a ficar em aberto.`,
                  confirmLabel: "Desfazer baixa",
                  cancelLabel: "Voltar",
                  variant: "default",
                  onConfirm: async () => {
                    await unpay.mutateAsync(receivable.id);
                  },
                })
              }
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <PayDialog
                receivable={receivable}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Baixar ${installmentLabel(receivable)}`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                }
              />
              <EditDialog
                receivable={receivable}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${installmentLabel(receivable)}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Excluir ${installmentLabel(receivable)}`}
                onClick={() =>
                  confirm({
                    title: "Excluir parcela",
                    description: `Tem certeza que deseja excluir "${installmentLabel(receivable)}"? Essa ação não pode ser desfeita.`,
                    confirmLabel: "Excluir",
                    onConfirm: () =>
                      deleteReceivable.mutateAsync({
                        id: receivable.id,
                        contractId: receivable.contractId,
                      }),
                  })
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {dialog}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Card "Recebimento" do detalhe do contrato -- sem plano: estado vazio +
 * "Definir plano"; com plano: tabela de parcelas com baixa/desfazer/editar/
 * excluir, progresso pago/total e (quando o contrato tem orçamento vinculado)
 * a margem realizada. */
export function InstallmentsCard({
  contractId,
  valorTotal,
  status,
  proposalId,
}: {
  contractId: string;
  valorTotal: string;
  status: ContractStatus;
  proposalId: string | null;
}) {
  const { data: receivables, isLoading, isError, refetch } = useReceivablesByContract(contractId);
  const { data: margin } = useContractMargin(contractId, { enabled: !!proposalId });

  const sorted = [...(receivables ?? [])].sort((a, b) => a.installmentIndex - b.installmentIndex);
  const totalAmount = sorted.reduce((acc, r) => acc + Number(r.amount), 0);
  const paidAmount = sorted.filter((r) => r.paidAt).reduce((acc, r) => acc + Number(r.amount), 0);
  const progressPct = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Recebimento</CardTitle>
        {sorted.length > 0 && (
          <PlanDialog
            contractId={contractId}
            valorTotal={valorTotal}
            trigger={
              <Button variant="outline" size="sm">
                Refazer plano
              </Button>
            }
          />
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status !== "ASSINADO" && (
          <p className="text-xs text-muted-foreground">
            Contrato ainda não assinado -- o plano pode ser definido, mas confirme antes de cobrar.
          </p>
        )}

        {isError ? (
          <ErrorState onRetry={() => refetch()} className="border-none" />
        ) : isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nenhum plano de recebimento"
            description="Defina a entrada e as parcelas deste contrato."
            action={
              <PlanDialog
                contractId={contractId}
                valorTotal={valorTotal}
                trigger={<Button>Definir plano</Button>}
              />
            }
            className="border-none py-10"
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parcela</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <ReceivableRow key={r.id} receivable={r} />
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(paidAmount)} de {formatCurrency(totalAmount)} recebido ·{" "}
                        {progressPct}%
                      </span>
                      <Progress value={progressPct} className="max-w-40" />
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>

            {proposalId && margin && (
              <p className="text-sm">
                <span className="text-muted-foreground">Margem realizada:</span>{" "}
                <strong>{formatCurrency(margin.realizedMargin)}</strong>
                {margin.projectedCost && (
                  <span className="text-muted-foreground">
                    {" "}
                    (custo projetado {formatCurrency(margin.projectedCost)})
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
