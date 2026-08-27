import type {
  AutomationArtifactType,
  AutomationEventType,
  AutomationExecutionStatus,
  AutomationStepKey,
  AutomationStepStatus,
  AutomationTrigger,
  ProjectChecklistType,
} from "@millead/database";

/**
 * Configuração por organização da automação pós-fechamento.
 *
 * Os três campos financeiros são anuláveis de propósito (ver o comentário do
 * model no schema): sem valor salvo a etapa de recebimentos vira pendência,
 * nunca um chute.
 */
export interface PostSaleAutomationSettings {
  id: string;
  organizationId: string;
  enabled: boolean;
  wonStageId: string | null;
  briefingTemplateKey: string | null;
  projectType: ProjectChecklistType | null;
  defaultOwnerId: string | null;
  createReceivables: boolean;
  installmentCount: number | null;
  entryDueDays: number | null;
  firstInstallmentDueDays: number | null;
  createBriefing: boolean;
  createProject: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationStep {
  id: string;
  executionId: string;
  key: AutomationStepKey;
  status: AutomationStepStatus;
  detail: string | null;
  error: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface AutomationArtifact {
  id: string;
  executionId: string;
  stepKey: AutomationStepKey;
  key: string;
  type: AutomationArtifactType;
  refId: string;
  label: string | null;
  createdAt: Date;
}

export interface AutomationExecution {
  id: string;
  organizationId: string;
  eventType: AutomationEventType;
  contractId: string;
  status: AutomationExecutionStatus;
  triggeredBy: AutomationTrigger;
  triggeredById: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
  payload: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecutionDetail extends AutomationExecution {
  steps: AutomationStep[];
  artifacts: AutomationArtifact[];
}

/** Ordem em que as etapas rodam -- também a ordem exibida na tela. TASKS é a
 *  última porque as tarefas operacionais dependem do que as anteriores
 *  produziram (só cria "confirmar entrada" se houve plano de recebimento). */
export const AUTOMATION_STEP_ORDER: AutomationStepKey[] = [
  "LEAD_WON",
  "RECEIVABLES",
  "BRIEFING",
  "PROJECT",
  "TASKS",
];
