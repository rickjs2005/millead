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
  useDeleteReceivable,
  usePayReceivable,
  useReceivablesStandalone,
  useUnpayReceivable,
  useUpdateReceivable,
} from "@/features/receivables/hooks";
import { StandaloneDialog } from "@/features/receivables/components/standalone-dialog";
import { formatCurrency } from "@/utils/format";
import type { Receivable } from "@/types/api";

/** `dueDate` chega date-only ("YYYY-MM-DD" ancorado em UTC) -- formatar no
 * fuso do browser viraria o dia anterior em fusos negativos (mesmo gotcha do
 * `installments-card.tsx`). */
function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
    new Date(value),
  );
}

type ReceivableStatus = "PAGA" | "VENCIDA" | "ABERTO";

function receivableStatus(r: Receivable): ReceivableStatus {
  if (r.paidAt) return "PAGA";
  return new Date(r.dueDate) < new Date() ? "VENCIDA" : "ABERTO";
}

const STATUS_LABELS: Record<ReceivableStatus, string> = {
  PAGA: "Paga",
  VENCIDA: "Vencida",
  ABERTO: "Pendente",
};

const STATUS_VARIANTS: Record<ReceivableStatus, "success" | "destructive" | "secondary"> = {
  PAGA: "success",
  VENCIDA: "destructive",
  ABERTO: "secondary",
};

const editSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe uma descrição.")
    .max(200, "Use até 200 caracteres."),
  amount: z.coerce.number().positive("Informe um valor válido."),
  dueDate: z.string().min(1, "Informe o vencimento."),
});
type EditValues = z.infer<typeof editSchema>;

function EditStandaloneDialog({ receivable, trigger }: { receivable: Receivable; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const update = useUpdateReceivable();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      description: receivable.description ?? "",
      amount: Number(receivable.amount),
      dueDate: receivable.dueDate.slice(0, 10),
    },
  });

  async function onSubmit(values: EditValues) {
    await update.mutateAsync({
      id: receivable.id,
      payload: { description: values.description, amount: values.amount, dueDate: values.dueDate },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Editar receita avulsa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-standalone-description">Descrição</Label>
              <Input id="edit-standalone-description" {...register("description")} />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-standalone-amount">Valor</Label>
              <Input id="edit-standalone-amount" inputMode="decimal" {...register("amount")} />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-standalone-due-date">Vencimento</Label>
              <Input id="edit-standalone-due-date" type="date" {...register("dueDate")} />
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

function StandaloneRow({ receivable }: { receivable: Receivable }) {
  const status = receivableStatus(receivable);
  const pay = usePayReceivable();
  const unpay = useUnpayReceivable();
  const deleteReceivable = useDeleteReceivable();
  const { confirm, dialog } = useConfirmDialog();
  const label = receivable.description ?? "Receita avulsa";

  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-muted-foreground">{formatDueDate(receivable.dueDate)}</TableCell>
      <TableCell>{formatCurrency(receivable.amount)}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {status === "PAGA" ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Estornar ${label}`}
              disabled={unpay.isPending}
              onClick={() =>
                confirm({
                  title: "Estornar recebimento",
                  description: `Estornar o recebimento de "${label}"? Ela volta a ficar pendente.`,
                  confirmLabel: "Estornar",
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Baixar ${label}`}
              disabled={pay.isPending}
              onClick={() =>
                confirm({
                  title: "Baixar receita",
                  description: `Confirmar o recebimento de "${label}" (${formatCurrency(receivable.amount)})?`,
                  confirmLabel: "Confirmar baixa",
                  cancelLabel: "Voltar",
                  variant: "default",
                  onConfirm: async () => {
                    await pay.mutateAsync({ id: receivable.id, payload: {} });
                  },
                })
              }
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <EditStandaloneDialog
            receivable={receivable}
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Editar ${label}`}>
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${label}`}
            onClick={() =>
              confirm({
                title: "Excluir receita",
                description: `Tem certeza que deseja excluir "${label}"? Essa ação não pode ser desfeita.`,
                confirmLabel: "Excluir",
                onConfirm: () =>
                  deleteReceivable.mutateAsync({ id: receivable.id, contractId: null }),
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

/** Tabela de receitas avulsas (sem contrato) na página "A Receber" -- entre
 * os cards de resumo e a tabela por contrato. Cada linha tem as mesmas ações
 * de uma parcela normal (baixar/estornar/editar/excluir), mas a edição
 * inclui a descrição (parcelas de contrato não têm esse campo). */
export function StandaloneTable() {
  const { data, isLoading, isError, refetch } = useReceivablesStandalone();
  const items = data ?? [];

  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-0">
        <CardTitle>Receitas avulsas</CardTitle>
        <StandaloneDialog
          trigger={
            <Button variant="outline" size="sm">
              + Receita
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isError ? (
          <ErrorState onRetry={() => refetch()} className="border-none" />
        ) : isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Nenhuma receita avulsa lançada"
            description="Receitas sem contrato, como repasses ou vendas avulsas."
            className="border-none py-10"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <StandaloneRow key={r.id} receivable={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
