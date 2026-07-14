"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useQueries, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Kanban } from "lucide-react";
import { useMoveLeadStage } from "@/features/leads/hooks";
import { usePipelines } from "@/features/pipeline/hooks";
import { companiesService } from "@/services/companies";
import { leadsService } from "@/services/leads";
import type { Lead } from "@/types/api";
import { KanbanColumn } from "./kanban-column";
import { KanbanLeadCard } from "./kanban-lead-card";

const CARDS_PER_COLUMN = 50;

export function KanbanBoard() {
  const {
    data: pipelines,
    isLoading: pipelinesLoading,
    isError: pipelinesError,
    refetch: refetchPipelines,
  } = usePipelines();
  const pipeline = pipelines?.find((p) => p.isDefault) ?? pipelines?.[0];
  const stages = useMemo(() => pipeline?.stages ?? [], [pipeline]);

  const stageQueries = useQueries({
    queries: stages.map((stage) => ({
      queryKey: ["crm", "stage-leads", stage.id],
      queryFn: () => leadsService.list({ pipelineStageId: stage.id, pageSize: CARDS_PER_COLUMN }),
    })),
  });

  const { data: companies } = useQuery({
    queryKey: ["crm", "companies-lookup"],
    queryFn: () => companiesService.list({ pageSize: 200 }),
  });
  const companyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of companies?.items ?? []) map.set(c.id, c.name);
    return map;
  }, [companies]);

  // Espelho local (otimista) dos leads por estágio -- sincronizado das
  // queries acima, mas atualizado NA HORA quando um card é solto, sem
  // esperar o round-trip da API. `PATCH /leads/:id/stage` é a fonte de
  // verdade; se falhar, a gente desfaz.
  const [columns, setColumns] = useState<Record<string, Lead[]>>({});
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const serverColumnsKey = stageQueries.map((q) => q.dataUpdatedAt).join(",");
  useMemo(() => {
    const next: Record<string, Lead[]> = {};
    stages.forEach((stage, i) => {
      next[stage.id] = stageQueries[i]?.data?.items ?? [];
    });
    setColumns(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sincroniza só quando os dados do servidor chegam, não a cada render
  }, [serverColumnsKey, stages.length]);

  const moveStage = useMoveLeadStage();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    setActiveLead(event.active.data.current?.lead ?? null);
  }

  function handleDragOver(event: { over: DragEndEvent["over"] }) {
    setOverStageId((event.over?.id as string) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveLead(null);
    setOverStageId(null);
    if (!over) return;

    const lead = active.data.current?.lead as Lead | undefined;
    const targetStageId = over.id as string;
    if (!lead || lead.pipelineStageId === targetStageId) return;

    const sourceStageId = lead.pipelineStageId;
    // Otimista: move o card na hora.
    setColumns((prev) => {
      const next = { ...prev };
      if (sourceStageId)
        next[sourceStageId] = (next[sourceStageId] ?? []).filter((l) => l.id !== lead.id);
      next[targetStageId] = [
        { ...lead, pipelineStageId: targetStageId },
        ...(next[targetStageId] ?? []),
      ];
      return next;
    });

    moveStage.mutate(
      { id: lead.id, pipelineStageId: targetStageId },
      {
        onError: () => {
          toast.error("Não foi possível mover o lead. Desfazendo.");
          setColumns((prev) => {
            const next = { ...prev };
            next[targetStageId] = (next[targetStageId] ?? []).filter((l) => l.id !== lead.id);
            if (sourceStageId) next[sourceStageId] = [lead, ...(next[sourceStageId] ?? [])];
            return next;
          });
        },
      },
    );
  }

  if (pipelinesLoading) {
    return (
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-72 shrink-0" />
        ))}
      </div>
    );
  }

  if (pipelinesError) {
    return <ErrorState onRetry={() => refetchPipelines()} />;
  }

  if (!pipeline || stages.length === 0) {
    return (
      <EmptyState
        icon={Kanban}
        title="Nenhum pipeline configurado"
        description="Crie um pipeline com estágios pra começar a usar o kanban."
        action={
          <Link
            href="/settings/pipeline"
            className="text-sm font-medium text-primary hover:underline"
          >
            Configurar pipeline
          </Link>
        }
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage, i) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={columns[stage.id] ?? []}
            isLoading={stageQueries[i]?.isLoading ?? false}
            companyNameById={companyNameById}
            isOver={overStageId === stage.id}
          />
        ))}
      </div>
      <DragOverlay>{activeLead && <KanbanLeadCard lead={activeLead} />}</DragOverlay>
    </DndContext>
  );
}
