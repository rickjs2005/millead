"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdatePhaseStatus } from "@/features/project-checklists/hooks";
import type { ProjectChecklistPhase, ProjectChecklistPhaseStatus } from "@/types/api";

const STATUS_LABELS: Record<ProjectChecklistPhaseStatus, string> = {
  NOT_STARTED: "Não iniciada",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluída",
  NOT_APPLICABLE: "N/A",
};

const STATUS_VARIANTS: Record<
  ProjectChecklistPhaseStatus,
  "outline" | "warning" | "success" | "secondary"
> = {
  NOT_STARTED: "outline",
  IN_PROGRESS: "warning",
  DONE: "success",
  NOT_APPLICABLE: "secondary",
};

export function PhaseStatusSelect({
  checklistId,
  phase,
}: {
  checklistId: string;
  phase: ProjectChecklistPhase;
}) {
  const updatePhaseStatus = useUpdatePhaseStatus(checklistId);
  const [pendingStatus, setPendingStatus] = useState<ProjectChecklistPhaseStatus | null>(null);
  const [naNote, setNaNote] = useState(phase.naNote ?? "");

  function commit(status: ProjectChecklistPhaseStatus, note?: string) {
    updatePhaseStatus.mutate({ phaseNumber: phase.phaseNumber, payload: { status, naNote: note } });
    setPendingStatus(null);
  }

  function handleChange(next: ProjectChecklistPhaseStatus) {
    if (next === "NOT_APPLICABLE") {
      // N/A exige nota -- abre o campo em vez de gravar direto (a API rejeita sem naNote).
      setPendingStatus(next);
      return;
    }
    commit(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Select value={phase.status} onValueChange={handleChange}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(STATUS_LABELS) as ProjectChecklistPhaseStatus[]).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant={STATUS_VARIANTS[phase.status]}>{STATUS_LABELS[phase.status]}</Badge>
      </div>

      {phase.status === "NOT_APPLICABLE" && phase.naNote && pendingStatus !== "NOT_APPLICABLE" && (
        <p className="text-xs text-muted-foreground">N/A — {phase.naNote}</p>
      )}

      {pendingStatus === "NOT_APPLICABLE" && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            placeholder="Motivo (obrigatório para marcar N/A)"
            value={naNote}
            onChange={(e) => setNaNote(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!naNote.trim() || updatePhaseStatus.isPending}
              onClick={() => commit("NOT_APPLICABLE", naNote.trim())}
            >
              Salvar N/A
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingStatus(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
