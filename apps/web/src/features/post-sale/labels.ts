import type {
  AutomationArtifactType,
  AutomationExecutionStatus,
  AutomationStepKey,
  AutomationStepStatus,
} from "@/types/api";

export const AUTOMATION_STEP_LABELS: Record<AutomationStepKey, string> = {
  LEAD_WON: "Lead marcado como ganho",
  RECEIVABLES: "Plano de recebimento",
  BRIEFING: "Briefing",
  PROJECT: "Projeto",
  TASKS: "Próximas tarefas",
};

export const AUTOMATION_STATUS_LABELS: Record<AutomationExecutionStatus, string> = {
  PENDING: "Na fila",
  RUNNING: "Executando",
  SUCCEEDED: "Concluída",
  PARTIAL: "Concluída com pendências",
  FAILED: "Falhou",
};

export const AUTOMATION_STATUS_VARIANT: Record<
  AutomationExecutionStatus,
  "default" | "success" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  RUNNING: "default",
  SUCCEEDED: "success",
  PARTIAL: "outline",
  FAILED: "destructive",
};

export const AUTOMATION_STEP_STATUS_LABELS: Record<AutomationStepStatus, string> = {
  PENDING: "Pendente",
  RUNNING: "Executando",
  SUCCEEDED: "Concluída",
  SKIPPED: "Desligada",
  NEEDS_ACTION: "Precisa de ação",
  FAILED: "Falhou",
};

/**
 * Rota do app para cada artefato criado pela automação. `RECEIVABLE_PLAN`
 * aponta pro contrato (é lá que o card de parcelas vive), não pra uma rota
 * de parcela -- ela não existe.
 */
export function artifactHref(
  type: AutomationArtifactType,
  refId: string,
  contractId: string,
): string {
  switch (type) {
    case "LEAD":
      return `/leads/${refId}`;
    case "BRIEFING":
      return `/briefings/${refId}`;
    case "PROJECT_CHECKLIST":
      return `/projetos/${refId}`;
    case "TASK":
      return "/tasks";
    case "RECEIVABLE_PLAN":
      return `/contracts/${contractId}`;
  }
}

export const AUTOMATION_ARTIFACT_LABELS: Record<AutomationArtifactType, string> = {
  LEAD: "Lead",
  RECEIVABLE_PLAN: "Recebimentos",
  BRIEFING: "Briefing",
  PROJECT_CHECKLIST: "Projeto",
  TASK: "Tarefa",
};

/** Uma execução em estado terminal com pendência ou falha é acionável: é
 *  quando o botão de reprocessar faz sentido. */
export function canReprocess(status: AutomationExecutionStatus): boolean {
  return status === "PENDING" || status === "PARTIAL" || status === "FAILED";
}
