"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Users2 } from "lucide-react";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_VARIANT,
} from "@/features/leads/lead-labels";
import type { Lead, PipelineStage } from "@/types/api";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency, formatDate } from "@/utils/format";

interface LeadsTableProps {
  leads: Lead[];
  isLoading: boolean;
  stagesById: Map<string, PipelineStage>;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}

export function LeadsTable({
  leads,
  isLoading,
  stagesById,
  selected,
  onToggleSelect,
  onToggleSelectAll,
}: LeadsTableProps) {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Users2}
        title="Nenhum lead encontrado"
        description="Ajuste os filtros ou crie o primeiro lead."
        className="border-none py-16"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleSelectAll}
              aria-label="Selecionar tudo"
            />
          </TableHead>
          <TableHead>Título</TableHead>
          <TableHead>Origem</TableHead>
          <TableHead>Estágio</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead>Criado em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map((lead) => {
          const stage = lead.pipelineStageId ? stagesById.get(lead.pipelineStageId) : undefined;
          return (
            <TableRow
              key={lead.id}
              className="cursor-pointer"
              data-state={selected.has(lead.id) ? "selected" : undefined}
              onClick={() => router.push(`/leads/${lead.id}`)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selected.has(lead.id)}
                  onCheckedChange={() => onToggleSelect(lead.id)}
                />
              </TableCell>
              <TableCell className="max-w-56 truncate font-medium text-foreground">
                {lead.title}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {LEAD_SOURCE_LABELS[lead.source]}
              </TableCell>
              <TableCell>
                {stage ? (
                  <Badge variant="outline" style={{ borderColor: stage.color, color: stage.color }}>
                    {stage.name}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>{formatCurrency(lead.value, lead.currency)}</TableCell>
              <TableCell>
                <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
                  {LEAD_STATUS_LABELS[lead.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {lead.ownerId ? (lead.ownerId === userId ? "Você" : "Outro membro") : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
