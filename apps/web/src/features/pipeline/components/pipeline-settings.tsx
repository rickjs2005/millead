"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Kanban, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAddPipelineStage, useCreatePipeline, usePipelines } from "@/features/pipeline/hooks";
import type { PipelineWithStages } from "@/types/api";

const DEFAULT_STAGE_COLOR = "#6366f1";

// ---------- Novo pipeline ----------

const pipelineSchema = z.object({
  name: z.string().min(1, "Informe o nome do pipeline."),
  isDefault: z.boolean().optional(),
});
type PipelineFormValues = z.infer<typeof pipelineSchema>;

function CreatePipelineDialog() {
  const [open, setOpen] = useState(false);
  const createPipeline = useCreatePipeline();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PipelineFormValues>({
    resolver: zodResolver(pipelineSchema),
    defaultValues: { name: "", isDefault: false },
  });

  async function onSubmit(values: PipelineFormValues) {
    await createPipeline.mutateAsync(values);
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> Novo pipeline
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Novo pipeline</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pipeline-name">Nome</Label>
              <Input id="pipeline-name" placeholder="Ex.: Vendas" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="isDefault"
                render={({ field }) => (
                  <Checkbox
                    id="pipeline-default"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <Label htmlFor="pipeline-default" className="font-normal">
                Usar como pipeline padrão da organização
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createPipeline.isPending}>
              {createPipeline.isPending ? "Criando…" : "Criar pipeline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Novo estágio ----------

const stageSchema = z
  .object({
    name: z.string().min(1, "Informe o nome do estágio."),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
    isWon: z.boolean().optional(),
    isLost: z.boolean().optional(),
  })
  .refine((v) => !(v.isWon && v.isLost), {
    message: "Um estágio não pode ser de ganho e de perda ao mesmo tempo.",
    path: ["isLost"],
  });
type StageFormValues = z.infer<typeof stageSchema>;

function AddStageDialog({ pipeline }: { pipeline: PipelineWithStages }) {
  const [open, setOpen] = useState(false);
  const addStage = useAddPipelineStage(pipeline.id);
  const nextOrder = pipeline.stages.reduce((max, s) => Math.max(max, s.order), 0) + 1;
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StageFormValues>({
    resolver: zodResolver(stageSchema),
    defaultValues: { name: "", color: DEFAULT_STAGE_COLOR, isWon: false, isLost: false },
  });

  async function onSubmit(values: StageFormValues) {
    await addStage.mutateAsync({ ...values, order: nextOrder });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Estágio
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Novo estágio em “{pipeline.name}”</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="grid grid-cols-[1fr_5rem] gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stage-name">Nome</Label>
                <Input id="stage-name" placeholder="Ex.: Proposta enviada" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="stage-color">Cor</Label>
                <Input id="stage-color" type="color" className="h-9 p-1" {...register("color")} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="isWon"
                  render={({ field }) => (
                    <Checkbox
                      id="stage-won"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <Label htmlFor="stage-won" className="font-normal">
                  Estágio de ganho (lead vira <Badge variant="success">Ganho</Badge> ao chegar
                  aqui)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="isLost"
                  render={({ field }) => (
                    <Checkbox
                      id="stage-lost"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <Label htmlFor="stage-lost" className="font-normal">
                  Estágio de perda (lead vira <Badge variant="destructive">Perdido</Badge>)
                </Label>
              </div>
              {errors.isLost && <p className="text-xs text-destructive">{errors.isLost.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={addStage.isPending}>
              {addStage.isPending ? "Salvando…" : "Adicionar estágio"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Lista ----------

function PipelineCard({ pipeline }: { pipeline: PipelineWithStages }) {
  const stages = [...pipeline.stages].sort((a, b) => a.order - b.order);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          {pipeline.name}
          {pipeline.isDefault && (
            <Badge variant="secondary" className="gap-1">
              <Star className="h-3 w-3" /> Padrão
            </Badge>
          )}
        </CardTitle>
        <AddStageDialog pipeline={pipeline} />
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum estágio ainda — o kanban só aparece depois do primeiro.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {stages.map((stage, i) => (
              <div key={stage.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <span className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  {stage.name}
                  {stage.isWon && <Badge variant="success">Ganho</Badge>}
                  {stage.isLost && <Badge variant="destructive">Perda</Badge>}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PipelineSettings() {
  const { data: pipelines, isLoading } = usePipelines();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Pipelines</h2>
          <p className="text-sm text-muted-foreground">
            Estágios que os leads percorrem no kanban do CRM.
          </p>
        </div>
        <CreatePipelineDialog />
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : !pipelines || pipelines.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title="Nenhum pipeline ainda"
          description="Crie o primeiro pipeline e adicione estágios pra liberar o kanban do CRM."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pipelines.map((pipeline) => (
            <PipelineCard key={pipeline.id} pipeline={pipeline} />
          ))}
        </div>
      )}
    </div>
  );
}
