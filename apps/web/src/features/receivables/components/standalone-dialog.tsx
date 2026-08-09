"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useCreateStandalone } from "@/features/receivables/hooks";

/** "YYYY-MM-DD" de hoje no fuso local -- default do input de vencimento
 * (mesmo helper de plan-dialog.tsx: date-only escolhido pelo usuário, não
 * precisa de America/Sao_Paulo aqui). */
function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const schema = z.object({
  description: z
    .string()
    .trim()
    .min(1, "Informe uma descrição.")
    .max(200, "Use até 200 caracteres."),
  amount: z.coerce.number().positive("Informe um valor válido."),
  dueDate: z.string().min(1, "Informe o vencimento."),
  alreadyPaid: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

/** Dialog de "+ Receita" -- lança uma receita SEM contrato (ex.: repasse
 * avulso, receita fora do fluxo de proposta/contrato). Diferente do
 * PlanDialog (que gera N parcelas de um contrato existente), este cria um
 * único Receivable kind=AVULSA via POST /receivables/standalone. */
export function StandaloneDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const createStandalone = useCreateStandalone();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: "",
      amount: 0,
      dueDate: todayInputValue(),
      alreadyPaid: false,
    },
  });

  const alreadyPaid = watch("alreadyPaid");

  async function onSubmit(values: FormValues) {
    await createStandalone.mutateAsync({
      description: values.description,
      amount: values.amount,
      dueDate: values.dueDate,
      alreadyPaid: values.alreadyPaid,
    });
    reset({ description: "", amount: 0, dueDate: todayInputValue(), alreadyPaid: false });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Lançar receita avulsa</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="standalone-description">Descrição</Label>
              <Input
                id="standalone-description"
                placeholder="Ex.: Repasse Rick"
                {...register("description")}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="standalone-amount">Valor</Label>
                <Input id="standalone-amount" inputMode="decimal" {...register("amount")} />
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="standalone-due-date">Vencimento</Label>
                <Input id="standalone-due-date" type="date" {...register("dueDate")} />
                {errors.dueDate && (
                  <p className="text-xs text-destructive">{errors.dueDate.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="standalone-already-paid"
                checked={alreadyPaid}
                onCheckedChange={(checked) => setValue("alreadyPaid", checked === true)}
              />
              <Label htmlFor="standalone-already-paid" className="cursor-pointer font-normal">
                Já recebi
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createStandalone.isPending}>
              {createStandalone.isPending ? "Salvando…" : "Lançar receita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
