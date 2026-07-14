"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
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
import { LeadCombobox } from "@/features/leads/components/lead-combobox";
import { useCreateProposal } from "@/features/proposals/hooks";

const schema = z.object({
  leadId: z.string().min(1, "Selecione o lead."),
  title: z.string().min(1, "Informe um título."),
  value: z.string().min(1, "Informe o valor."),
  validUntil: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateProposalDialog() {
  const [open, setOpen] = useState(false);
  const createProposal = useCreateProposal();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(values: FormValues) {
    await createProposal.mutateAsync({ ...values, validUntil: values.validUntil || undefined });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Nova proposta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Nova proposta</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Lead</Label>
              <Controller
                control={control}
                name="leadId"
                render={({ field }) => (
                  <LeadCombobox value={field.value} onChange={(id) => field.onChange(id ?? "")} />
                )}
              />
              {errors.leadId && <p className="text-xs text-destructive">{errors.leadId.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="value">Valor (R$)</Label>
                <Input id="value" inputMode="decimal" {...register("value")} />
                {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="validUntil">Válida até</Label>
                <Input id="validUntil" type="date" {...register("validUntil")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createProposal.isPending}>
              {createProposal.isPending ? "Criando…" : "Criar proposta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
