import { prisma, Prisma } from "@millead/database";
import type { AutomationExecutionStatus, AutomationTrigger } from "@millead/database";
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

type ExecutionRow = Prisma.AutomationExecutionGetPayload<{
  include: { steps: true; artifacts: true };
}>;

function toStep(row: {
  id: string;
  executionId: string;
  key: AutomationStep["key"];
  status: AutomationStep["status"];
  detail: string | null;
  error: string | null;
  attempts: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}): AutomationStep {
  return {
    id: row.id,
    executionId: row.executionId,
    key: row.key,
    status: row.status,
    detail: row.detail,
    error: row.error,
    attempts: row.attempts,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

function toArtifact(row: {
  id: string;
  executionId: string;
  stepKey: AutomationArtifact["stepKey"];
  key: string;
  type: AutomationArtifact["type"];
  refId: string;
  label: string | null;
  createdAt: Date;
}): AutomationArtifact {
  return {
    id: row.id,
    executionId: row.executionId,
    stepKey: row.stepKey,
    key: row.key,
    type: row.type,
    refId: row.refId,
    label: row.label,
    createdAt: row.createdAt,
  };
}

/** Ordena as etapas na sequência de execução (o banco devolveria por id). */
function sortSteps(steps: AutomationStep[]): AutomationStep[] {
  return [...steps].sort(
    (a, b) => AUTOMATION_STEP_ORDER.indexOf(a.key) - AUTOMATION_STEP_ORDER.indexOf(b.key),
  );
}

function toExecution(row: Omit<ExecutionRow, "steps" | "artifacts">): AutomationExecution {
  return {
    id: row.id,
    organizationId: row.organizationId,
    eventType: row.eventType,
    contractId: row.contractId,
    status: row.status,
    triggeredBy: row.triggeredBy,
    triggeredById: row.triggeredById,
    attempts: row.attempts,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    error: row.error,
    payload: row.payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDetail(row: ExecutionRow): AutomationExecutionDetail {
  const { steps, artifacts, ...execution } = row;
  return {
    ...toExecution(execution),
    steps: sortSteps(steps.map(toStep)),
    artifacts: artifacts.map(toArtifact),
  };
}

export class PrismaPostSaleAutomationRepository implements PostSaleAutomationRepository {
  async findSettings(organizationId: string): Promise<PostSaleAutomationSettings | null> {
    return prisma.postSaleAutomationSettings.findUnique({ where: { organizationId } });
  }

  async upsertSettings(
    organizationId: string,
    input: UpdatePostSaleSettingsInput,
  ): Promise<PostSaleAutomationSettings> {
    return prisma.postSaleAutomationSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...input },
      update: input,
    });
  }

  async ensureExecution(input: EnsureExecutionInput): Promise<AutomationExecutionDetail> {
    const where = {
      organizationId_eventType_contractId: {
        organizationId: input.organizationId,
        eventType: "CONTRACT_SIGNED" as const,
        contractId: input.contractId,
      },
    };

    // `update: {}` de propósito: reencontrar a execução existente NÃO pode
    // mexer em status, tentativas nem em quem disparou -- reenvio de webhook
    // é "achar a mesma linha", não "reabrir a execução". Quem reprocessa
    // chama setTrigger/claimExecution explicitamente.
    const row = await prisma.automationExecution.upsert({
      where,
      update: {},
      create: {
        organizationId: input.organizationId,
        eventType: "CONTRACT_SIGNED",
        contractId: input.contractId,
        triggeredBy: input.triggeredBy,
        triggeredById: input.triggeredById,
        payload: (input.payload ?? Prisma.DbNull) as Prisma.InputJsonValue,
        steps: {
          create: AUTOMATION_STEP_ORDER.map((key) => ({
            organizationId: input.organizationId,
            key,
          })),
        },
      },
      include: { steps: true, artifacts: true },
    });
    return toDetail(row);
  }

  async findExecutionByContract(
    organizationId: string,
    contractId: string,
  ): Promise<AutomationExecutionDetail | null> {
    const row = await prisma.automationExecution.findFirst({
      where: { organizationId, contractId },
      include: { steps: true, artifacts: true },
    });
    return row ? toDetail(row) : null;
  }

  async findExecutionById(
    organizationId: string,
    executionId: string,
  ): Promise<AutomationExecutionDetail | null> {
    const row = await prisma.automationExecution.findFirst({
      where: { id: executionId, organizationId },
      include: { steps: true, artifacts: true },
    });
    return row ? toDetail(row) : null;
  }

  async claimExecution(
    executionId: string,
    fromStatuses: AutomationExecutionStatus[],
    startedAt: Date,
  ): Promise<boolean> {
    // updateMany com o status no WHERE é o compare-and-swap: duas chamadas
    // concorrentes (webhook reenviado + reprocessamento manual) disputam a
    // mesma linha e só uma sai com count > 0.
    const result = await prisma.automationExecution.updateMany({
      where: { id: executionId, status: { in: fromStatuses } },
      data: {
        status: "RUNNING",
        startedAt,
        finishedAt: null,
        error: null,
        attempts: { increment: 1 },
      },
    });
    return result.count > 0;
  }

  async finishExecution(
    executionId: string,
    status: AutomationExecutionStatus,
    finishedAt: Date,
    error: string | null,
  ): Promise<AutomationExecution | null> {
    const result = await prisma.automationExecution.updateMany({
      where: { id: executionId, status: "RUNNING" },
      data: { status, finishedAt, error },
    });
    if (result.count === 0) return null;
    const row = await prisma.automationExecution.findUnique({ where: { id: executionId } });
    return row ? toExecution(row) : null;
  }

  async listPending(organizationId: string, limit: number): Promise<PendingAutomation[]> {
    const rows = await prisma.automationExecution.findMany({
      where: { organizationId, status: { in: ["PENDING", "PARTIAL", "FAILED"] } },
      include: {
        steps: true,
        contract: { select: { numero: true, company: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    });

    return rows.map((row) => ({
      executionId: row.id,
      contractId: row.contractId,
      contractNumero: row.contract.numero,
      companyName: row.contract.company?.name ?? null,
      status: row.status,
      finishedAt: row.finishedAt,
      // SKIPPED e SUCCEEDED ficam de fora: o card é sobre o que exige ação.
      // RUNNING também -- está em andamento, não parada.
      pendingSteps: sortSteps(
        row.steps
          .filter((s) => s.status === "NEEDS_ACTION" || s.status === "FAILED" || s.status === "PENDING")
          .map(toStep),
      ).map((s) => ({ key: s.key, status: s.status, detail: s.detail })),
    }));
  }

  async setTrigger(
    executionId: string,
    triggeredBy: AutomationTrigger,
    triggeredById: string | null,
  ): Promise<void> {
    await prisma.automationExecution.update({
      where: { id: executionId },
      data: { triggeredBy, triggeredById },
    });
  }

  async updateStep(
    executionId: string,
    key: AutomationStep["key"],
    input: UpdateStepInput,
  ): Promise<AutomationStep | null> {
    const row = await prisma.automationStep.update({
      where: { executionId_key: { executionId, key } },
      data: {
        status: input.status,
        detail: input.detail,
        error: input.error,
        startedAt: input.startedAt ?? undefined,
        finishedAt: input.finishedAt ?? undefined,
        ...(input.incrementAttempts ? { attempts: { increment: 1 } } : {}),
      },
    });
    return toStep(row);
  }

  async listSteps(executionId: string): Promise<AutomationStep[]> {
    const rows = await prisma.automationStep.findMany({ where: { executionId } });
    return sortSteps(rows.map(toStep));
  }

  async recordArtifact(input: RecordArtifactInput): Promise<AutomationArtifact> {
    // upsert com `update: {}`: se já existe, devolve o que está lá sem
    // sobrescrever o refId -- reprocessar não "re-aponta" um artefato antigo
    // pra uma entidade nova.
    const row = await prisma.automationArtifact.upsert({
      where: { executionId_key: { executionId: input.executionId, key: input.key } },
      update: {},
      create: {
        organizationId: input.organizationId,
        executionId: input.executionId,
        stepKey: input.stepKey,
        key: input.key,
        type: input.type,
        refId: input.refId,
        label: input.label ?? null,
      },
    });
    return toArtifact(row);
  }

  async findArtifact(executionId: string, key: string): Promise<AutomationArtifact | null> {
    const row = await prisma.automationArtifact.findUnique({
      where: { executionId_key: { executionId, key } },
    });
    return row ? toArtifact(row) : null;
  }

  async listArtifacts(executionId: string): Promise<AutomationArtifact[]> {
    const rows = await prisma.automationArtifact.findMany({
      where: { executionId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toArtifact);
  }
}
