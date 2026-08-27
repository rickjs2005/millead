import type {
  AutomationExecutionStatus,
  AutomationStepKey,
  AutomationTrigger,
} from "@millead/database";
import {
  AUTOMATION_STEP_ORDER,
  type AutomationArtifact,
  type AutomationExecution,
  type AutomationExecutionDetail,
  type AutomationStep,
  type PendingAutomation,
  type PostSaleAutomationSettings,
} from "../../domain/entities/post-sale-automation.js";
import type {
  EnsureExecutionInput,
  PostSaleAutomationRepository,
  RecordArtifactInput,
  UpdatePostSaleSettingsInput,
  UpdateStepInput,
} from "../../domain/repositories/post-sale-automation-repository.js";

/**
 * Fake em memória do repositório da automação, usado pelos testes.
 *
 * Não é um `vi.fn()` genérico de propósito: as garantias que este módulo
 * precisa provar (webhook reenviado não duplica nada, reprocessamento roda só
 * o que falta) moram justamente nas travas de unicidade -- um mock que aceita
 * tudo passaria nos testes e mentiria. Este fake reproduz as três travas
 * reais do schema:
 *   - uma execução por (organização, contrato)
 *   - uma etapa por (execução, chave)
 *   - um artefato por (execução, chave)
 * ...e o compare-and-swap de `claimExecution`.
 *
 * Vive em `services/` (e não num `__fixtures__`) porque o vitest só coleta
 * `*.test.ts`; este arquivo é importado pelos testes, não executado como um.
 */
export class FakePostSaleAutomationRepository implements PostSaleAutomationRepository {
  settings = new Map<string, PostSaleAutomationSettings>();
  executions = new Map<string, AutomationExecution>();
  steps = new Map<string, AutomationStep>(); // chave: `${executionId}::${key}`
  artifacts = new Map<string, AutomationArtifact>(); // chave: `${executionId}::${key}`
  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  seedSettings(input: Partial<PostSaleAutomationSettings> & { organizationId: string }): void {
    const now = new Date("2026-08-26T12:00:00Z");
    this.settings.set(input.organizationId, {
      id: this.nextId("settings"),
      enabled: true,
      wonStageId: null,
      briefingTemplateKey: null,
      projectType: null,
      defaultOwnerId: null,
      createReceivables: true,
      installmentCount: null,
      entryDueDays: null,
      firstInstallmentDueDays: null,
      createBriefing: true,
      createProject: true,
      createdAt: now,
      updatedAt: now,
      ...input,
    });
  }

  async findSettings(organizationId: string): Promise<PostSaleAutomationSettings | null> {
    return this.settings.get(organizationId) ?? null;
  }

  async upsertSettings(
    organizationId: string,
    input: UpdatePostSaleSettingsInput,
  ): Promise<PostSaleAutomationSettings> {
    const existing = this.settings.get(organizationId);
    if (!existing) this.seedSettings({ organizationId, enabled: false });
    const merged = { ...this.settings.get(organizationId)!, ...input, updatedAt: new Date() };
    this.settings.set(organizationId, merged);
    return merged;
  }

  async ensureExecution(input: EnsureExecutionInput): Promise<AutomationExecutionDetail> {
    const found = [...this.executions.values()].find(
      (e) => e.organizationId === input.organizationId && e.contractId === input.contractId,
    );
    if (found) return this.detail(found);

    const now = new Date();
    const execution: AutomationExecution = {
      id: this.nextId("exec"),
      organizationId: input.organizationId,
      eventType: "CONTRACT_SIGNED",
      contractId: input.contractId,
      status: "PENDING",
      triggeredBy: input.triggeredBy,
      triggeredById: input.triggeredById,
      attempts: 0,
      startedAt: null,
      finishedAt: null,
      error: null,
      payload: input.payload,
      createdAt: now,
      updatedAt: now,
    };
    this.executions.set(execution.id, execution);
    for (const key of AUTOMATION_STEP_ORDER) {
      this.steps.set(`${execution.id}::${key}`, {
        id: this.nextId("step"),
        executionId: execution.id,
        key,
        status: "PENDING",
        detail: null,
        error: null,
        attempts: 0,
        startedAt: null,
        finishedAt: null,
      });
    }
    return this.detail(execution);
  }

  private detail(execution: AutomationExecution): AutomationExecutionDetail {
    return {
      ...execution,
      steps: AUTOMATION_STEP_ORDER.map((key) => this.steps.get(`${execution.id}::${key}`)!).filter(
        Boolean,
      ),
      artifacts: [...this.artifacts.values()].filter((a) => a.executionId === execution.id),
    };
  }

  async findExecutionByContract(
    organizationId: string,
    contractId: string,
  ): Promise<AutomationExecutionDetail | null> {
    const found = [...this.executions.values()].find(
      (e) => e.organizationId === organizationId && e.contractId === contractId,
    );
    return found ? this.detail(found) : null;
  }

  async findExecutionById(
    organizationId: string,
    executionId: string,
  ): Promise<AutomationExecutionDetail | null> {
    const found = this.executions.get(executionId);
    // O filtro por organização é parte do contrato do repositório real --
    // sem ele aqui, um teste de vazamento entre tenants passaria de graça.
    if (!found || found.organizationId !== organizationId) return null;
    return this.detail(found);
  }

  /** Espelha o filtro do repositório real: só execuções paradas, e dentro
   *  delas só as etapas que exigem ação. */
  async listPending(organizationId: string, limit: number): Promise<PendingAutomation[]> {
    return [...this.executions.values()]
      .filter(
        (e) =>
          e.organizationId === organizationId &&
          (e.status === "PENDING" || e.status === "PARTIAL" || e.status === "FAILED"),
      )
      .slice(0, limit)
      .map((e) => ({
        executionId: e.id,
        contractId: e.contractId,
        contractNumero: (e.payload as { numero?: string } | null)?.numero ?? "",
        companyName: null,
        status: e.status,
        finishedAt: e.finishedAt,
        pendingSteps: AUTOMATION_STEP_ORDER.map((key) => this.steps.get(`${e.id}::${key}`)!)
          .filter(
            (step) =>
              step &&
              (step.status === "NEEDS_ACTION" ||
                step.status === "FAILED" ||
                step.status === "PENDING"),
          )
          .map((step) => ({ key: step.key, status: step.status, detail: step.detail })),
      }));
  }

  async claimExecution(
    executionId: string,
    fromStatuses: AutomationExecutionStatus[],
    startedAt: Date,
  ): Promise<boolean> {
    const execution = this.executions.get(executionId);
    if (!execution || !fromStatuses.includes(execution.status)) return false;
    execution.status = "RUNNING";
    execution.startedAt = startedAt;
    execution.finishedAt = null;
    execution.error = null;
    execution.attempts += 1;
    return true;
  }

  async finishExecution(
    executionId: string,
    status: AutomationExecutionStatus,
    finishedAt: Date,
    error: string | null,
  ): Promise<AutomationExecution | null> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== "RUNNING") return null;
    execution.status = status;
    execution.finishedAt = finishedAt;
    execution.error = error;
    return execution;
  }

  async setTrigger(
    executionId: string,
    triggeredBy: AutomationTrigger,
    triggeredById: string | null,
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;
    execution.triggeredBy = triggeredBy;
    execution.triggeredById = triggeredById;
  }

  async updateStep(
    executionId: string,
    key: AutomationStepKey,
    input: UpdateStepInput,
  ): Promise<AutomationStep | null> {
    const step = this.steps.get(`${executionId}::${key}`);
    if (!step) return null;
    step.status = input.status;
    if (input.detail !== undefined) step.detail = input.detail;
    if (input.error !== undefined) step.error = input.error;
    if (input.startedAt) step.startedAt = input.startedAt;
    if (input.finishedAt) step.finishedAt = input.finishedAt;
    if (input.incrementAttempts) step.attempts += 1;
    return step;
  }

  async listSteps(executionId: string): Promise<AutomationStep[]> {
    return AUTOMATION_STEP_ORDER.map((key) => this.steps.get(`${executionId}::${key}`)!).filter(
      Boolean,
    );
  }

  async recordArtifact(input: RecordArtifactInput): Promise<AutomationArtifact> {
    const mapKey = `${input.executionId}::${input.key}`;
    const existing = this.artifacts.get(mapKey);
    if (existing) return existing; // unique (executionId, key) -- não sobrescreve
    const artifact: AutomationArtifact = {
      id: this.nextId("artifact"),
      executionId: input.executionId,
      stepKey: input.stepKey,
      key: input.key,
      type: input.type,
      refId: input.refId,
      label: input.label ?? null,
      createdAt: new Date(),
    };
    this.artifacts.set(mapKey, artifact);
    return artifact;
  }

  async findArtifact(executionId: string, key: string): Promise<AutomationArtifact | null> {
    return this.artifacts.get(`${executionId}::${key}`) ?? null;
  }

  async listArtifacts(executionId: string): Promise<AutomationArtifact[]> {
    return [...this.artifacts.values()].filter((a) => a.executionId === executionId);
  }
}
