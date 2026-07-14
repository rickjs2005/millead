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
  DialogDescription,
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
import { CompanyCombobox } from "@/features/companies/components/company-combobox";
import { useCreateLead } from "@/features/leads/hooks";
import { LEAD_SOURCE_LABELS } from "@/features/leads/lead-labels";

const schema = z.object({
  title: z.string().min(1, "Informe um título."),
  companyId: z.string().optional(),
  source: z.enum(["MANUAL", "IMPORT", "SCRAPER", "REFERRAL", "INBOUND"]),
  value: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateLeadDialog() {
  const [open, setOpen] = useState(false);
  const createLead = useCreateLead();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { source: "MANUAL" } });

  async function onSubmit(values: FormValues) {
    await createLead.mutateAsync({
      title: values.title,
      companyId: values.companyId || undefined,
      source: values.source,
      value: values.value || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo lead
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Novo lead</DialogTitle>
            <DialogDescription>
              Cria o lead já no primeiro estágio do pipeline padrão da organização.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" placeholder="Ex.: Loja iPhone Centro" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Empresa</Label>
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
                <Label>Origem</Label>
                <Controller
                  control={control}
                  name="source"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(LEAD_SOURCE_LABELS).map(([value, label]) => (
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
                <Label htmlFor="value">Valor estimado (R$)</Label>
                <Input id="value" placeholder="0,00" inputMode="decimal" {...register("value")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending ? "Criando…" : "Criar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
