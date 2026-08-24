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
import { useCreateProjectChecklist } from "@/features/project-checklists/hooks";

const schema = z.object({
  name: z.string().min(1, "Informe um nome."),
  type: z.enum(["INSTITUTIONAL", "SYSTEM"]),
  companyId: z.string().optional(),
  localFolder: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function CreateProjectChecklistDialog() {
  const [open, setOpen] = useState(false);
  const createProjectChecklist = useCreateProjectChecklist();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "INSTITUTIONAL" },
  });

  async function onSubmit(values: FormValues) {
    await createProjectChecklist.mutateAsync({
      name: values.name,
      type: values.type,
      companyId: values.companyId || undefined,
      localFolder: values.localFolder || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo projeto
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>
              Cria o checklist já com as 16 fases do tipo escolhido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" placeholder="Ex.: Kavita Drones — Landing" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSTITUTIONAL">Institucional / Landing</SelectItem>
                      <SelectItem value="SYSTEM">Sistema (banco + backend + frontend)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="localFolder">Pasta local (opcional)</Label>
              <Input
                id="localFolder"
                placeholder="Ex.: kavita-drones-landing"
                {...register("localFolder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createProjectChecklist.isPending}>
              {createProjectChecklist.isPending ? "Criando…" : "Criar projeto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
