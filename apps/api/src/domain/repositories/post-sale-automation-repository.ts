import type {
  AutomationArtifactType,
  AutomationExecutionStatus,
  AutomationStepKey,
  AutomationStepStatus,
  AutomationTrigger,
  ProjectChecklistType,
} from "@millead/database";
import type {
  AutomationArtifact,
  AutomationExecution,
  AutomationExecutionDetail,
  AutomationStep,
  PendingAutomation,
  PostSaleAutomationSettings,
} from "../entities/post-sale-automation.js";

export interface UpdatePostSaleSettingsInput {
  enabled?: boolean;
  wonStageId?: string | null;
  briefingTemplateKey?: string | null;
  projectType?: ProjectChecklistType | null;
  defaultOwnerId?: string | null;
  createReceivables?: boolean;
  installmentCount?: number | null;
  entryDueDays?: number | null;
  firstInstallmentDueDays?: number | null;
  createBriefing?: boolean;
  createProject?: boolean;
}

export interface EnsureExecutionInput {
  organizationId: string;
  contractId: string;
  triggeredBy: AutomationTrigger;
  triggeredById: string | null;
  payload: unknown;
}

export interface UpdateStepInput {
  status: AutomationStepStatus;
  detail?: string | null;
  error?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  /** Soma +1 nas tentativas da etapa (usado ao começar a rodá-la). */
  incrementAttempts?: boolean;
}

export interface RecordArtifactInput {
  organizationId: string;
  executionId: string;
  stepKey: AutomationStepKey;
  key: string;
  type: AutomationArtifactType;
  refId: string;
  label?: string | null;
}

/**
 * Dono do agregado da automação pós-fechamento: configuração + execuções +
 * etapas + artefatos. Todas as leituras são escopadas por `organizationId`;
 * nenhum método aceita um id cru sem a organização junto.
 */
export interface PostSaleAutomationRepository {
  // ---- Configuração ----
  findSettings(organizationId: string): Promise<PostSaleAutomationSettings | null>;
  upsertSettings(
    organizationId: string,
    input: UpdatePostSaleSettingsInput,
  ): Promise<PostSaleAutomationSettings>;

  // ---- Execução ----
  /**
   * Idempotente: devolve a execução existente do par (organização, contrato)
   * ou cria uma nova PENDING com as etapas semeadas. O `@@unique` no banco é
   * a garantia real -- duas chamadas concorrentes do mesmo webhook não criam
   * duas execuções.
   */
  ensureExecution(input: EnsureExecutionInput): Promise<AutomationExecutionDetail>;
  findExecutionByContract(
    organizationId: string,
    contractId: string,
  ): Promise<AutomationExecutionDetail | null>;
  findExecutionById(
    organizationId: string,
    executionId: string,
  ): Promise<AutomationExecutionDetail | null>;
  /**
   * CAS: marca RUNNING só se o status atual for um dos `fromStatuses`, e soma
   * +1 nas tentativas. `false` significa que outra execução já está rodando
   * (ou que já terminou com sucesso) -- o chamador desiste sem reprocessar.
   */
  claimExecution(
    executionId: string,
    fromStatuses: AutomationExecutionStatus[],
    startedAt: Date,
  ): Promise<boolean>;
  finishExecution(
    executionId: string,
    status: AutomationExecutionStatus,
    finishedAt: Date,
    error: string | null,
  ): Promise<AutomationExecution | null>;
  /**
   * Execuções que pararam no meio (PENDING, PARTIAL ou FAILED), mais recentes
   * primeiro -- alimenta o card de pendências do painel. SUCCEEDED nunca
   * aparece: não há o que fazer com ela.
   */
  listPending(organizationId: string, limit: number): Promise<PendingAutomation[]>;
  /** Registra quem/como disparou a execução mais recente (reprocessamento). */
  setTrigger(
    executionId: string,
    triggeredBy: AutomationTrigger,
    triggeredById: string | null,
  ): Promise<void>;

  // ---- Etapas ----
  updateStep(
    executionId: string,
    key: AutomationStepKey,
    input: UpdateStepInput,
  ): Promise<AutomationStep | null>;
  listSteps(executionId: string): Promise<AutomationStep[]>;

  // ---- Artefatos ----
  /**
   * Idempotente por (executionId, key): se o artefato já existe, devolve o
   * existente SEM criar outro -- é isto que impede briefing/projeto/tarefa
   * duplicados no reenvio do webhook.
   */
  recordArtifact(input: RecordArtifactInput): Promise<AutomationArtifact>;
  findArtifact(executionId: string, key: string): Promise<AutomationArtifact | null>;
  listArtifacts(executionId: string): Promise<AutomationArtifact[]>;
}
