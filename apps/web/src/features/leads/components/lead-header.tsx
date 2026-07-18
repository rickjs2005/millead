"use client";

import { ArrowLeft, Building2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeadAiMenu } from "@/features/ai/components/lead-ai-menu";
import { scoreColorClass } from "@/features/audit/audit-labels";
import { EditLeadDialog } from "@/features/leads/components/edit-lead-dialog";
import { useDeleteLead, useMoveLeadStage } from "@/features/leads/hooks";
import { LEAD_STATUS_LABELS, LEAD_STATUS_VARIANT } from "@/features/leads/lead-labels";
import { cn } from "@/lib/utils";
import { usePipelines } from "@/features/pipeline/hooks";
import { formatCurrency } from "@/utils/format";
import type { LeadDetail } from "@/types/api";

export function LeadHeader({ lead, companyName }: { lead: LeadDetail; companyName?: string }) {
  const router = useRouter();
  const { data: pipelines } = usePipelines();
  const moveStage = useMoveLeadStage();
  const deleteLead = useDeleteLead();
  const { confirm, dialog } = useConfirmDialog();
  const pipeline =
    pipelines?.find((p) => p.stages.some((s) => s.id === lead.pipelineStageId)) ?? pipelines?.[0];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/leads"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Leads
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{lead.title}</h1>
            <Badge variant={LEAD_STATUS_VARIANT[lead.status]}>
              {LEAD_STATUS_LABELS[lead.status]}
            </Badge>
            {lead.score !== null && (
              <Badge
                variant="outline"
                className={cn("gap-1 tabular-nums", scoreColorClass(lead.score))}
                title="Score de oportunidade calculado pela IA"
              >
                ★ {lead.score}
              </Badge>
            )}
          </div>
          {companyName && (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> {companyName}
            </p>
          )}
          {lead.value && (
            <p className="text-lg font-medium text-foreground">
              {formatCurrency(lead.value, lead.currency)}
            </p>
          )}
        </div>

        <div className="flex flex-col items-start gap-2 sm:flex-row">
          <LeadAiMenu lead={lead} />
          <EditLeadDialog key={lead.updatedAt} lead={lead} companyName={companyName} />
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              confirm({
                title: "Excluir lead",
                description: `Excluir "${lead.title}"? Essa ação não pode ser desfeita. Se houver reuniões, propostas ou mensagens vinculadas, resolva-as antes.`,
                confirmLabel: "Excluir",
                onConfirm: async () => {
                  await deleteLead.mutateAsync(lead.id);
                  router.push("/leads");
                },
              })
            }
          >
            <Trash2 /> Excluir
          </Button>
          {pipeline && (
            <div className="flex flex-col gap-1.5">
              <Select
                value={lead.pipelineStageId ?? undefined}
                onValueChange={(stageId) =>
                  moveStage.mutate({ id: lead.id, pipelineStageId: stageId })
                }
                disabled={moveStage.isPending}
              >
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Selecionar estágio" />
                </SelectTrigger>
                <SelectContent>
                  {pipeline.stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs font-medium text-muted-foreground">Estágio do pipeline</span>
            </div>
          )}
        </div>
      </div>
      {dialog}
    </div>
  );
}
