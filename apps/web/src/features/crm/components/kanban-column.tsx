"use client";

import { useDroppable } from "@dnd-kit/core";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Lead, PipelineStage } from "@/types/api";
import { formatCurrency } from "@/utils/format";
import { KanbanLeadCard } from "./kanban-lead-card";

interface KanbanColumnProps {
  stage: PipelineStage;
  leads: Lead[];
  isLoading: boolean;
  companyNameById: Map<string, string>;
  isOver: boolean;
}

export function KanbanColumn({
  stage,
  leads,
  isLoading,
  companyNameById,
  isOver,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: stage.id, data: { stage } });

  // Soma o valor dos leads da coluna (quanto tem em cada estágio do funil).
  const totalValue = leads.reduce((sum, lead) => sum + Number(lead.value ?? 0), 0);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/40">
      <div className="flex items-start justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <div className="flex flex-col">
            <h3 className="text-sm font-medium leading-tight">{stage.name}</h3>
            {totalValue > 0 && (
              <span className="text-xs text-muted-foreground">{formatCurrency(totalValue)}</span>
            )}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">{leads.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto scrollbar-thin rounded-lg p-2 pt-0 transition-colors",
          isOver && "bg-primary/5 ring-1 ring-inset ring-primary/40",
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : (
          leads.map((lead) => (
            <KanbanLeadCard
              key={lead.id}
              lead={lead}
              companyName={lead.companyId ? companyNameById.get(lead.companyId) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
