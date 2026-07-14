"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useUpdateLead } from "@/features/leads/hooks";
import type { LeadDetail } from "@/types/api";

const CURRENCIES = ["BRL", "USD", "EUR"] as const;

const schema = z.object({
  title: z.string().min(1, "Informe um título."),
  companyId: z.string().optional(),
  value: z.string().optional(),
  currency: z.enum(CURRENCIES),
  lostReason: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function EditLeadDialog({
  lead,
  companyName,
}: {
  lead: LeadDetail;
  companyName?: string;
}) {
  const [open, setOpen] = useState(false);
  const updateLead = useUpdateLead(lead.id);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: lead.title,
      companyId: lead.companyId ?? undefined,
      value: lead.value ?? "",
      currency: CURRENCIES.includes(lead.currency as (typeof CURRENCIES)[number])
        ? (lead.currency as (typeof CURRENCIES)[number])
        : "BRL",
      lostReason: lead.lostReason ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    await updateLead.mutateAsync({
      title: values.title,
      // Sempre enviado: null desvincula a empresa, id troca o vínculo.
      companyId: values.companyId ?? null,
      value: values.value === "" ? null : values.value,
      currency: values.currency,
      lostReason:
        lead.status === "LOST" ? (values.lostReason === "" ? null : values.lostReason) : undefined,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil /> Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Editar lead</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lead-title">Título</Label>
              <Input id="lead-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Empresa</Label>
              <Controller
                control={control}
                name="companyId"
                render={({ field }) => (
                  <CompanyCombobox
                    value={field.value}
                    onChange={(id) => field.onChange(id)}
                    initialLabel={companyName}
                  />
                )}
              />
            </div>
            <div className="grid grid-cols-[1fr_7rem] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-value">Valor</Label>
                <Input
                  id="lead-value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  {...register("value")}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Moeda</Label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {lead.status === "LOST" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lead-lost-reason">Motivo da perda</Label>
                <Textarea id="lead-lost-reason" rows={2} {...register("lostReason")} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateLead.isPending}>
              {updateLead.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
