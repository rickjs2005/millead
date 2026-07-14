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
import { Textarea } from "@/components/ui/textarea";
import { useCreateCompany, useUpdateCompany } from "@/features/companies/hooks";
import type { Company } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Informe o nome da empresa."),
  document: z.string().optional(),
  segment: z.string().optional(),
  sizeEstimate: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/** Campos vazios viram undefined -- o PATCH da API ignora campo ausente (não limpa). */
function toPayload(values: FormValues) {
  return {
    name: values.name,
    document: values.document || undefined,
    segment: values.segment || undefined,
    sizeEstimate: values.sizeEstimate || undefined,
    city: values.city || undefined,
    state: values.state || undefined,
    phone: values.phone || undefined,
    email: values.email || undefined,
    notes: values.notes || undefined,
  };
}

/** Dialog compartilhado de criar/editar: passe `company` pra entrar em modo edição. */
export function CompanyFormDialog({
  company,
  trigger,
}: {
  company?: Company;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany(company?.id ?? "");
  const isEdit = !!company;
  const pending = isEdit ? updateCompany.isPending : createCompany.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: company?.name ?? "",
      document: company?.document ?? "",
      segment: company?.segment ?? "",
      sizeEstimate: company?.sizeEstimate ?? "",
      city: company?.city ?? "",
      state: company?.state ?? "",
      phone: company?.phone ?? "",
      email: company?.email ?? "",
      notes: company?.notes ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    if (isEdit) {
      await updateCompany.mutateAsync(toPayload(values));
    } else {
      await createCompany.mutateAsync(toPayload(values));
      reset();
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Editar empresa" : "Nova empresa"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-name">Nome</Label>
              <Input id="company-name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company-document">CNPJ</Label>
                <Input id="company-document" {...register("document")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company-segment">Segmento</Label>
                <Input id="company-segment" placeholder="Ex.: Restaurante" {...register("segment")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company-size">Porte estimado</Label>
                <Input id="company-size" placeholder="Ex.: 1-10 funcionários" {...register("sizeEstimate")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company-phone">Telefone</Label>
                <Input id="company-phone" {...register("phone")} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_5rem] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company-city">Cidade</Label>
                <Input id="company-city" {...register("city")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="company-state">UF</Label>
                <Input id="company-state" maxLength={2} placeholder="SP" {...register("state")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-email">E-mail</Label>
              <Input id="company-email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company-notes">Observações</Label>
              <Textarea id="company-notes" rows={3} {...register("notes")} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar empresa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
