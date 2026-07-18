"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useConfirmDialog } from "@/components/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useDeleteLead } from "@/features/leads/hooks";
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
  const deleteLead = useDeleteLead();
  const { confirm, dialog } = useConfirmDialog();

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
    <>
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
            <TableHead className="w-10" />
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
                    <Badge
                      variant="outline"
                      style={{ borderColor: stage.color, color: stage.color }}
                    >
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
                <TableCell className="text-muted-foreground">
                  {formatDate(lead.createdAt)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() =>
                          confirm({
                            title: "Excluir lead",
                            description: `Excluir "${lead.title}"? Essa ação não pode ser desfeita. Se houver reuniões, propostas ou mensagens vinculadas, resolva-as antes.`,
                            confirmLabel: "Excluir",
                            onConfirm: async () => {
                              await deleteLead.mutateAsync(lead.id);
                            },
                          })
                        }
                      >
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {dialog}
    </>
  );
}
