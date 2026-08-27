import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Contract, ContractDetail } from "../../domain/entities/contract.js";
import type { LeadDetail } from "../../domain/entities/lead.js";
import type { PipelineStage } from "../../domain/entities/pipeline.js";
import type { Receivable } from "../../domain/entities/receivable.js";
import { ValidationError } from "../../domain/errors/app-error.js";
import { FakePostSaleAutomationRepository } from "./post-sale-fakes.js";
import {
  dueDateFrom,
  PostSaleOnboardingService,
  resolveExecutionStatus,
  type PostSaleOnboardingDeps,
} from "./post-sale-onboarding-service.js";

const ORG = "org-1";
const OTHER_ORG = "org-2";
const CONTRACT_ID = "contract-1";
const LEAD_ID = "lead-1";
const COMPANY_ID = "company-1";
const OWNER_ID = "user-owner";
const WON_STAGE_ID = "stage-won";
const SIGNED_AT = new Date("2026-08-26T14:30:00Z");

function fakeContract(overrides: Partial<ContractDetail> = {}): ContractDetail {
  return {
    id: CONTRACT_ID,
    organizationId: ORG,
    companyId: COMPANY_ID,
    leadId: LEAD_ID,
    createdById: "user-creator",
    proposalId: null,
    numero: "MILWEB-2026-000001",
    tipo: "SITE",
    status: "ASSINADO",
    descricaoProjeto: "Site institucional",
    valorTotal: "10000.00",
    formaPagamento: "PIX",
    percentualEntrada: "50.00",
    prazoEntregaDias: 30,
    limiteRevisoes: 2,
    contractorSnapshot: {},
    contractedSnapshot: {},
    provider: "MOCK",
    signatureDocId: "doc-1",
    signatureUrl: null,
    assinadoEm: SIGNED_AT,
    hasPdfOriginal: true,
    hasPdfAssinado: true,
    falhouProcessamento: false,
    createdAt: SIGNED_AT,
    updatedAt: SIGNED_AT,
    signers: [],
    events: [],
    ...overrides,
  };
}

function fakeLead(overrides: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: LEAD_ID,
    organizationId: ORG,
    companyId: COMPANY_ID,
    pipelineStageId: "stage-proposta",
    ownerId: null,
    title: "Cliente LTDA — site",
    source: "MANUAL",
    status: "OPEN",
    score: null,
    value: null,
    currency: "BRL",
    lostReason: null,
    closedAt: null,
    createdAt: SIGNED_AT,
    updatedAt: SIGNED_AT,
    contacts: [],
    notes: [],
    tags: [],
    ...overrides,
  };
}

function fakeWonStage(overrides: Partial<PipelineStage> = {}): PipelineStage {
  return {
    id: WON_STAGE_ID,
    organizationId: ORG,
    pipelineId: "pipeline-1",
    name: "Fechado",
    order: 5,
    color: "#22c55e",
    isWon: true,
    isLost: false,
    createdAt: SIGNED_AT,
    ...overrides,
  };
}

function fakeReceivable(overrides: Partial<Receivable> = {}): Receivable {
  return {
    id: "recv-1",
    organizationId: ORG,
    contractId: CONTRACT_ID,
    description: null,
    kind: "ENTRADA",
    installmentIndex: 0,
    amount: "5000.00",
    dueDate: new Date("2026-08-29T00:00:00Z"),
    paidAt: null,
    paidNote: null,
    ...overrides,
  };
}

/** Estado observável de tudo que a automação pode criar -- é o que os testes
 *  inspecionam pra provar "criou uma vez só". */
interface Harness {
  service: PostSaleOnboardingService;
  automation: FakePostSaleAutomationRepository;
  deps: PostSaleOnboardingDeps;
  createdTasks: { title: string; leadId?: string; assigneeId?: string }[];
  createdBriefings: unknown[];
  createdProjects: unknown[];
  createdPlans: unknown[];
  movedStages: { leadId: string; stageId: string; userId: string | null }[];
  contractEvents: string[];
  enqueued: { executionId: string }[];
  pushes: { title: string }[];
  receivables: Receivable[];
}

interface HarnessOptions {
  contract?: ContractDetail | null;
  lead?: LeadDetail | null;
  stage?: PipelineStage | null;
  existingReceivables?: Receivable[];
  existingBriefing?: { id: string } | null;
  existingProject?: { id: string; name: string } | null;
  createPlanImpl?: () => Promise<Receivable[]>;
  createBriefingImpl?: () => Promise<{ id: string }>;
  createProjectImpl?: () => Promise<{ id: string; name: string; phases: unknown[] }>;
}

function makeHarness(options: HarnessOptions = {}): Harness {
  const automation = new FakePostSaleAutomationRepository();
  const createdTasks: Harness["createdTasks"] = [];
  const createdBriefings: unknown[] = [];
  const createdProjects: unknown[] = [];
  const createdPlans: unknown[] = [];
  const movedStages: Harness["movedStages"] = [];
  const contractEvents: string[] = [];
  const enqueued: { executionId: string }[] = [];
  const pushes: { title: string }[] = [];
  const receivables = [...(options.existingReceivables ?? [])];

  const contract = options.contract === undefined ? fakeContract() : options.contract;

  const deps: PostSaleOnboardingDeps = {
    automation,
    contracts: {
      findByIdForOrg: vi.fn(async (id: string, organizationId: string) =>
        contract && contract.id === id && contract.organizationId === organizationId
          ? contract
          : null,
      ),
      addEvent: vi.fn(async (_c: string, _o: string, tipo: string) => {
        contractEvents.push(tipo);
      }),
    } as unknown as PostSaleOnboardingDeps["contracts"],
    companies: {
      findByIdForOrg: vi.fn(async () => ({ id: COMPANY_ID, name: "Cliente LTDA" })),
    } as unknown as PostSaleOnboardingDeps["companies"],
    leads: {
      findByIdForOrg: vi.fn(async () =>
        options.lead === undefined ? fakeLead() : options.lead,
      ),
    } as unknown as PostSaleOnboardingDeps["leads"],
    pipelines: {
      findStageForOrg: vi.fn(async () =>
        options.stage === undefined ? fakeWonStage() : options.stage,
      ),
    } as unknown as PostSaleOnboardingDeps["pipelines"],
    receivables: {
      listByContract: vi.fn(async () => receivables),
    } as unknown as PostSaleOnboardingDeps["receivables"],
    leadService: {
      moveStage: vi.fn(async (_org: string, userId: string | null, leadId: string, stageId: string) => {
        movedStages.push({ leadId, stageId, userId });
        return fakeLead({ status: "WON" });
      }),
    } as unknown as PostSaleOnboardingDeps["leadService"],
    receivableService: {
      createPlan: vi.fn(async (_org: string, input: unknown) => {
        createdPlans.push(input);
        const created = options.createPlanImpl
          ? await options.createPlanImpl()
          : [fakeReceivable(), fakeReceivable({ id: "recv-2", kind: "PARCELA", installmentIndex: 1 })];
        receivables.push(...created);
        return created;
      }),
    } as unknown as PostSaleOnboardingDeps["receivableService"],
    briefingService: {
      findByContract: vi.fn(async () => options.existingBriefing ?? null),
      create: vi.fn(async (_org: string, _by: string | null, input: unknown) => {
        createdBriefings.push(input);
        return options.createBriefingImpl
          ? await options.createBriefingImpl()
          : { id: `briefing-${createdBriefings.length}` };
      }),
    } as unknown as PostSaleOnboardingDeps["briefingService"],
    projectChecklistService: {
      findByContract: vi.fn(async () => options.existingProject ?? null),
      create: vi.fn(async (_org: string, input: unknown) => {
        createdProjects.push(input);
        return options.createProjectImpl
          ? await options.createProjectImpl()
          : { id: `project-${createdProjects.length}`, name: "Cliente LTDA — MILWEB-2026-000001", phases: new Array(16).fill({}) };
      }),
    } as unknown as PostSaleOnboardingDeps["projectChecklistService"],
    taskService: {
      create: vi.fn(async (_org: string, input: { title: string }) => {
        createdTasks.push(input);
        return { id: `task-${createdTasks.length}` };
      }),
    } as unknown as PostSaleOnboardingDeps["taskService"],
    activityLogger: { log: vi.fn(async () => undefined) } as unknown as PostSaleOnboardingDeps["activityLogger"],
    push: {
      sendToOrg: vi.fn(async (_org: string, payload: { title: string }) => {
        pushes.push(payload);
      }),
    },
    queue: {
      enqueue: vi.fn(async (job: { executionId: string }) => {
        enqueued.push(job);
      }),
    },
    webPublicUrl: "https://millead.test",
  };

  return {
    service: new PostSaleOnboardingService(deps),
    automation,
    deps,
    createdTasks,
    createdBriefings,
    createdProjects,
    createdPlans,
    movedStages,
    contractEvents,
    enqueued,
    pushes,
    receivables,
  };
}

/** Configuração "tudo preenchido" -- o cenário feliz da requisição. */
function fullSettings(automation: FakePostSaleAutomationRepository): void {
  automation.seedSettings({
    organizationId: ORG,
    enabled: true,
    wonStageId: WON_STAGE_ID,
    briefingTemplateKey: "institucional-v1",
    projectType: "INSTITUTIONAL",
    defaultOwnerId: OWNER_ID,
    createReceivables: true,
    installmentCount: 2,
    entryDueDays: 3,
    firstInstallmentDueDays: 30,
    createBriefing: true,
    createProject: true,
  });
}

/** Roda o ciclo completo: dispara (webhook) e processa (worker). */
async function triggerAndRun(h: Harness, contract: Contract = fakeContract()) {
  await h.service.trigger(contract);
  const execution = await h.service.getByContract(ORG, contract.id);
  return h.service.run(ORG, execution!.id);
}

describe("resolveExecutionStatus", () => {
  it("tudo SUCCEEDED vira SUCCEEDED", () => {
    expect(resolveExecutionStatus(["SUCCEEDED", "SUCCEEDED"])).toBe("SUCCEEDED");
  });

  it("SKIPPED nao conta como pendencia -- automacao com sub-opcoes desligadas e sucesso", () => {
    expect(resolveExecutionStatus(["SKIPPED", "SKIPPED", "SUCCEEDED"])).toBe("SUCCEEDED");
    expect(resolveExecutionStatus(["SKIPPED", "SKIPPED"])).toBe("SUCCEEDED");
  });

  it("qualquer NEEDS_ACTION ao lado de sucesso vira PARTIAL", () => {
    expect(resolveExecutionStatus(["SUCCEEDED", "NEEDS_ACTION"])).toBe("PARTIAL");
  });

  it("so vira FAILED quando TODAS as etapas relevantes falharam", () => {
    expect(resolveExecutionStatus(["FAILED", "FAILED"])).toBe("FAILED");
    expect(resolveExecutionStatus(["FAILED", "SUCCEEDED"])).toBe("PARTIAL");
  });
});

describe("dueDateFrom", () => {
  it("normaliza pra meia-noite UTC (dueDate e date-only no financeiro)", () => {
    expect(dueDateFrom(new Date("2026-08-26T23:45:00Z"), 3).toISOString()).toBe(
      "2026-08-29T00:00:00.000Z",
    );
  });

  it("dia zero devolve a propria data zerada, sem arrastar a hora da assinatura", () => {
    expect(dueDateFrom(new Date("2026-08-26T14:30:00Z"), 0).toISOString()).toBe(
      "2026-08-26T00:00:00.000Z",
    );
  });
});

describe("PostSaleOnboardingService — caminho completo", () => {
  let h: Harness;

  beforeEach(() => {
    h = makeHarness();
    fullSettings(h.automation);
  });

  it("1. contrato assinado com configuracao completa conclui todas as etapas", async () => {
    const execution = await triggerAndRun(h);

    expect(execution.status).toBe("SUCCEEDED");
    expect(execution.steps.map((s) => s.status)).toEqual([
      "SUCCEEDED",
      "SUCCEEDED",
      "SUCCEEDED",
      "SUCCEEDED",
      "SUCCEEDED",
    ]);
    expect(h.contractEvents).toContain("AUTOMACAO_INICIADA");
    expect(h.contractEvents).toContain("AUTOMACAO_CONCLUIDA");
  });

  it("2. lead vai pro estagio de ganho configurado, pelo service existente", async () => {
    await triggerAndRun(h);

    expect(h.movedStages).toEqual([
      { leadId: LEAD_ID, stageId: WON_STAGE_ID, userId: OWNER_ID },
    ]);
  });

  it("3. plano de recebimento sai do valor e do percentual do contrato", async () => {
    await triggerAndRun(h);

    expect(h.createdPlans).toHaveLength(1);
    expect(h.createdPlans[0]).toMatchObject({
      contractId: CONTRACT_ID,
      total: 10000,
      entryAmount: 5000, // 50% de 10.000, do proprio contrato
    });
    const plan = h.createdPlans[0] as { installments: { amount: number; dueDate: Date }[] };
    expect(plan.installments).toHaveLength(2);
    expect(plan.installments.reduce((sum, i) => sum + i.amount, 0)).toBe(5000);
    // entrada vence 3 dias depois da assinatura (26/08 -> 29/08), meia-noite UTC
    expect((h.createdPlans[0] as { entryDueDate: Date }).entryDueDate.toISOString()).toBe(
      "2026-08-29T00:00:00.000Z",
    );
  });

  it("4. briefing e criado vinculado a lead, empresa e contrato", async () => {
    await triggerAndRun(h);

    expect(h.createdBriefings).toEqual([
      {
        templateKey: "institucional-v1",
        leadId: LEAD_ID,
        companyId: COMPANY_ID,
        contractId: CONTRACT_ID,
      },
    ]);
  });

  it("5. projeto e criado com tipo, nome, prazo e vinculos do contrato", async () => {
    await triggerAndRun(h);

    expect(h.createdProjects).toEqual([
      {
        name: "Cliente LTDA — MILWEB-2026-000001",
        type: "INSTITUTIONAL",
        companyId: COMPANY_ID,
        leadId: LEAD_ID,
        contractId: CONTRACT_ID,
        startedAt: SIGNED_AT,
        // 26/08 + 30 dias de prazo do contrato
        dueAt: new Date("2026-09-25T00:00:00Z"),
      },
    ]);
  });

  it("6. tarefas nascem com responsavel e lead do contrato", async () => {
    await triggerAndRun(h);

    expect(h.createdTasks.length).toBeGreaterThan(0);
    for (const task of h.createdTasks) {
      expect(task.assigneeId).toBe(OWNER_ID);
      expect(task.leadId).toBe(LEAD_ID);
    }
    const titles = h.createdTasks.map((t) => t.title);
    expect(titles.some((t) => t.startsWith("Confirmar pagamento da entrada"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Preparar kickoff"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Iniciar a primeira fase"))).toBe(true);
  });
});

describe("PostSaleOnboardingService — idempotencia", () => {
  it("7. reenviar o webhook 3x nao duplica nada", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    const contract = fakeContract();

    await h.service.trigger(contract);
    await h.service.trigger(contract);
    await h.service.trigger(contract);

    // Uma execução só, mesmo com três webhooks.
    expect(h.automation.executions.size).toBe(1);
    const execution = await h.service.getByContract(ORG, CONTRACT_ID);

    await h.service.run(ORG, execution!.id);
    await h.service.run(ORG, execution!.id);
    await h.service.run(ORG, execution!.id);

    expect(h.createdBriefings).toHaveLength(1);
    expect(h.createdProjects).toHaveLength(1);
    expect(h.createdPlans).toHaveLength(1);
    expect(h.movedStages).toHaveLength(1);
    const titles = h.createdTasks.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length); // nenhuma tarefa repetida
  });

  it("7b. rodar de novo apos SUCCEEDED nem sequer reivindica a execucao", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    const first = await triggerAndRun(h);
    expect(first.status).toBe("SUCCEEDED");
    const attemptsAfterFirst = first.attempts;

    const second = await h.service.run(ORG, first.id);

    expect(second.status).toBe("SUCCEEDED");
    expect(second.attempts).toBe(attemptsAfterFirst);
  });

  it("8. reprocessamento roda so o que ficou pendente e nao repete o que deu certo", async () => {
    const h = makeHarness();
    // Sem template de briefing: a etapa BRIEFING vira pendencia.
    h.automation.seedSettings({
      organizationId: ORG,
      enabled: true,
      wonStageId: WON_STAGE_ID,
      briefingTemplateKey: null,
      projectType: "INSTITUTIONAL",
      defaultOwnerId: OWNER_ID,
      installmentCount: 2,
      entryDueDays: 3,
      firstInstallmentDueDays: 30,
    });

    const partial = await triggerAndRun(h);
    expect(partial.status).toBe("PARTIAL");
    expect(partial.steps.find((s) => s.key === "BRIEFING")?.status).toBe("NEEDS_ACTION");
    const projectsAfterFirst = h.createdProjects.length;
    const plansAfterFirst = h.createdPlans.length;

    // O dono configura o template e reprocessa.
    await h.automation.upsertSettings(ORG, { briefingTemplateKey: "institucional-v1" });
    await h.service.reprocess(ORG, CONTRACT_ID, "user-admin");
    const done = await h.service.run(ORG, partial.id);

    expect(done.status).toBe("SUCCEEDED");
    expect(h.createdBriefings).toHaveLength(1); // criado agora, na 2a passada
    expect(h.createdProjects).toHaveLength(projectsAfterFirst); // nao recriou
    expect(h.createdPlans).toHaveLength(plansAfterFirst); // nao recriou
    expect(h.contractEvents).toContain("AUTOMACAO_REPROCESSADA");
  });

  it("reprocessar automacao ja concluida e recusado com mensagem clara", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    await triggerAndRun(h);

    await expect(h.service.reprocess(ORG, CONTRACT_ID, "user-admin")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("PostSaleOnboardingService — configuracao incompleta vira pendencia", () => {
  it("9. sem configuracao financeira nao inventa parcelas: cria tarefa", async () => {
    const h = makeHarness();
    h.automation.seedSettings({
      organizationId: ORG,
      enabled: true,
      wonStageId: WON_STAGE_ID,
      briefingTemplateKey: "institucional-v1",
      projectType: "INSTITUTIONAL",
      defaultOwnerId: OWNER_ID,
      createReceivables: true,
      installmentCount: null, // <- o dono nunca decidiu
      entryDueDays: null,
      firstInstallmentDueDays: null,
    });

    const execution = await triggerAndRun(h);

    expect(h.createdPlans).toHaveLength(0);
    expect(execution.steps.find((s) => s.key === "RECEIVABLES")?.status).toBe("NEEDS_ACTION");
    expect(execution.status).toBe("PARTIAL");
    expect(h.createdTasks.map((t) => t.title)).toContain("Definir plano de recebimento");
  });

  it("10. sem template de briefing cria a tarefa de selecionar e enviar", async () => {
    const h = makeHarness();
    h.automation.seedSettings({
      organizationId: ORG,
      enabled: true,
      wonStageId: WON_STAGE_ID,
      briefingTemplateKey: null,
      projectType: "INSTITUTIONAL",
      defaultOwnerId: OWNER_ID,
      installmentCount: 2,
      entryDueDays: 3,
      firstInstallmentDueDays: 30,
    });

    const execution = await triggerAndRun(h);

    expect(h.createdBriefings).toHaveLength(0);
    expect(execution.steps.find((s) => s.key === "BRIEFING")?.status).toBe("NEEDS_ACTION");
    expect(h.createdTasks.map((t) => t.title)).toContain("Selecionar e enviar briefing");
  });

  it("11. sem estagio de ganho o lead NAO e movido pra estagio arbitrario", async () => {
    const h = makeHarness();
    h.automation.seedSettings({
      organizationId: ORG,
      enabled: true,
      wonStageId: null,
      briefingTemplateKey: "institucional-v1",
      projectType: "INSTITUTIONAL",
      defaultOwnerId: OWNER_ID,
      installmentCount: 2,
      entryDueDays: 3,
      firstInstallmentDueDays: 30,
    });

    const execution = await triggerAndRun(h);

    expect(h.movedStages).toHaveLength(0);
    expect(execution.steps.find((s) => s.key === "LEAD_WON")?.status).toBe("NEEDS_ACTION");
    expect(h.createdTasks.map((t) => t.title)).toContain(
      "Configurar o estágio de ganho do pipeline",
    );
  });

  it("11b. estagio configurado que deixou de ser de ganho vira pendencia, nao movimento", async () => {
    const h = makeHarness({ stage: fakeWonStage({ isWon: false }) });
    fullSettings(h.automation);

    const execution = await triggerAndRun(h);

    expect(h.movedStages).toHaveLength(0);
    expect(execution.steps.find((s) => s.key === "LEAD_WON")?.status).toBe("NEEDS_ACTION");
  });

  it("sem tipo de projeto configurado cria a tarefa de preparar o projeto", async () => {
    const h = makeHarness();
    h.automation.seedSettings({
      organizationId: ORG,
      enabled: true,
      wonStageId: WON_STAGE_ID,
      briefingTemplateKey: "institucional-v1",
      projectType: null,
      defaultOwnerId: OWNER_ID,
      installmentCount: 2,
      entryDueDays: 3,
      firstInstallmentDueDays: 30,
    });

    const execution = await triggerAndRun(h);

    expect(h.createdProjects).toHaveLength(0);
    expect(execution.steps.find((s) => s.key === "PROJECT")?.status).toBe("NEEDS_ACTION");
    expect(h.createdTasks.map((t) => t.title)).toContain("Preparar o projeto");
  });
});

describe("PostSaleOnboardingService — contratos fora do caso feliz", () => {
  it("12. contrato sem lead pula a etapa de lead e segue com o resto", async () => {
    const contract = fakeContract({ leadId: null });
    const h = makeHarness({ contract });
    fullSettings(h.automation);

    const execution = await h.service.trigger(contract).then(async () => {
      const e = await h.service.getByContract(ORG, CONTRACT_ID);
      return h.service.run(ORG, e!.id);
    });

    expect(execution.steps.find((s) => s.key === "LEAD_WON")?.status).toBe("SKIPPED");
    expect(execution.status).toBe("SUCCEEDED"); // SKIPPED nao e pendencia
    expect(h.createdBriefings).toHaveLength(1);
    expect(h.createdTasks.every((t) => t.leadId === undefined)).toBe(true);
  });

  it("13. sem empresa cadastrada o projeto ainda nasce, com nome generico", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    (h.deps.companies.findByIdForOrg as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await triggerAndRun(h);

    expect(h.createdProjects[0]).toMatchObject({ name: "Cliente — MILWEB-2026-000001" });
  });

  it("14. execucao de outra organizacao nao e acessivel nem executavel", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    await h.service.trigger(fakeContract());
    const execution = await h.service.getByContract(ORG, CONTRACT_ID);

    // Mesmo id de execução, organização errada: nada vaza.
    await expect(h.service.run(OTHER_ORG, execution!.id)).rejects.toThrow();
    expect(await h.service.getByContract(OTHER_ORG, CONTRACT_ID)).toBeNull();
    expect(h.createdBriefings).toHaveLength(0);
  });

  it("14b. reprocessar contrato de outra organizacao devolve nao encontrado", async () => {
    const h = makeHarness();
    fullSettings(h.automation);

    await expect(h.service.reprocess(OTHER_ORG, CONTRACT_ID, "user-x")).rejects.toThrow(
      /Contrato não encontrado/,
    );
  });

  it("contrato que nao esta ASSINADO nao dispara reprocessamento", async () => {
    const h = makeHarness({ contract: fakeContract({ status: "AGUARDANDO_ASSINATURA" }) });
    fullSettings(h.automation);

    await expect(h.service.reprocess(ORG, CONTRACT_ID, "user-x")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("PostSaleOnboardingService — a assinatura nunca e comprometida", () => {
  it("16. falha numa etapa nao derruba as outras nem propaga pro chamador", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    (h.deps.receivableService.createPlan as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("banco indisponivel"),
    );

    const execution = await triggerAndRun(h);

    expect(execution.steps.find((s) => s.key === "RECEIVABLES")?.status).toBe("FAILED");
    expect(execution.steps.find((s) => s.key === "RECEIVABLES")?.error).toContain(
      "banco indisponivel",
    );
    // As etapas seguintes continuaram normalmente.
    expect(execution.steps.find((s) => s.key === "BRIEFING")?.status).toBe("SUCCEEDED");
    expect(execution.steps.find((s) => s.key === "PROJECT")?.status).toBe("SUCCEEDED");
    expect(execution.status).toBe("PARTIAL");
  });

  it("16b. falha ao enfileirar nao propaga: vira evento na timeline do contrato", async () => {
    const h = makeHarness();
    fullSettings(h.automation);
    (h.deps.queue.enqueue as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("fila fora"));

    await expect(h.service.trigger(fakeContract())).resolves.toBeNull();

    expect(h.contractEvents).toContain("AUTOMACAO_FALHA_DISPARO");
    // A execução ficou registrada: o botão "Reprocessar" na tela resolve.
    expect(await h.service.getByContract(ORG, CONTRACT_ID)).not.toBeNull();
  });

  it("automacao desligada nao cria execucao nenhuma", async () => {
    const h = makeHarness();
    h.automation.seedSettings({ organizationId: ORG, enabled: false });

    await expect(h.service.trigger(fakeContract())).resolves.toBeNull();

    expect(h.automation.executions.size).toBe(0);
    expect(h.enqueued).toHaveLength(0);
  });

  it("organizacao sem configuracao nenhuma nao dispara automacao", async () => {
    const h = makeHarness();

    await expect(h.service.trigger(fakeContract())).resolves.toBeNull();

    expect(h.automation.executions.size).toBe(0);
  });
});

describe("PostSaleOnboardingService — plano de recebimento existente", () => {
  it("nao recria plano que ja tem parcela paga", async () => {
    const h = makeHarness({
      existingReceivables: [fakeReceivable({ paidAt: new Date("2026-08-27T10:00:00Z") })],
    });
    fullSettings(h.automation);

    const execution = await triggerAndRun(h);

    expect(h.createdPlans).toHaveLength(0);
    const step = execution.steps.find((s) => s.key === "RECEIVABLES");
    expect(step?.status).toBe("SUCCEEDED");
    expect(step?.detail).toContain("paga");
  });

  it("entrada de 100% gera plano sem parcelas seguintes", async () => {
    const contract = fakeContract({ percentualEntrada: "100.00" });
    const h = makeHarness({ contract });
    fullSettings(h.automation);

    await h.service.trigger(contract);
    const e = await h.service.getByContract(ORG, CONTRACT_ID);
    await h.service.run(ORG, e!.id);

    expect(h.createdPlans[0]).toMatchObject({ entryAmount: 10000, installments: [] });
  });

  it("percentual que nao divide redondo e arredondado em centavos", async () => {
    const contract = fakeContract({ valorTotal: "1000.00", percentualEntrada: "33.00" });
    const h = makeHarness({ contract });
    fullSettings(h.automation);

    await h.service.trigger(contract);
    const e = await h.service.getByContract(ORG, CONTRACT_ID);
    await h.service.run(ORG, e!.id);

    const plan = h.createdPlans[0] as {
      entryAmount: number;
      installments: { amount: number }[];
    };
    expect(plan.entryAmount).toBe(330);
    // 670 em 2 parcelas: 335 + 335, soma exata com o total do contrato
    expect(plan.entryAmount + plan.installments.reduce((s, i) => s + i.amount, 0)).toBe(1000);
  });
});

describe("PostSaleOnboardingService — notificacoes", () => {
  it("notifica uma vez por MUDANCA de desfecho, nao a cada reprocessamento", async () => {
    const h = makeHarness();
    h.automation.seedSettings({
      organizationId: ORG,
      enabled: true,
      wonStageId: WON_STAGE_ID,
      briefingTemplateKey: null, // gera PARTIAL
      projectType: "INSTITUTIONAL",
      defaultOwnerId: OWNER_ID,
      installmentCount: 2,
      entryDueDays: 3,
      firstInstallmentDueDays: 30,
    });

    const execution = await triggerAndRun(h);
    const pushesAfterFirst = h.pushes.filter((p) => p.title.includes("Pós-fechamento")).length;
    expect(pushesAfterFirst).toBe(1);

    // Reprocessa sem mudar nada: continua PARTIAL, não notifica de novo.
    await h.service.reprocess(ORG, CONTRACT_ID, "user-admin");
    await h.service.run(ORG, execution.id);

    expect(h.pushes.filter((p) => p.title.includes("Pós-fechamento"))).toHaveLength(1);
  });
});
