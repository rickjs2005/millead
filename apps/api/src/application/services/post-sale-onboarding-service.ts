import type {
  AutomationExecutionStatus,
  AutomationStepKey,
  AutomationStepStatus,
} from "@millead/database";
import type { Contract } from "../../domain/entities/contract.js";
import type {
  AutomationExecutionDetail,
  PostSaleAutomationSettings,
} from "../../domain/entities/post-sale-automation.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";
import type { PostSaleAutomationRepository } from "../../domain/repositories/post-sale-automation-repository.js";
import type { ReceivableRepository } from "../../domain/repositories/receivable-repository.js";
import type { PostSaleQueue } from "../../domain/services/post-sale-queue.js";
import type { PushSender } from "../../domain/services/push-sender.js";
import type { ActivityLogger } from "./activity-logger.js";
import type { BriefingService } from "./briefing-service.js";
import type { LeadService } from "./lead-service.js";
import type { ProjectChecklistService } from "./project-checklist-service.js";
import { buildPlan } from "./receivable-plan.js";
import type { ReceivableService } from "./receivable-service.js";
import type { TaskService } from "./task-service.js";

/** Resultado interno de uma etapa. `detail` vai pra tela; `pendency` vira
 *  tarefa acionável quando faltou configuração. */
interface StepOutcome {
  status: AutomationStepStatus;
  detail: string;
  error?: string;
}

const SKIP = (detail: string): StepOutcome => ({ status: "SKIPPED", detail });
const OK = (detail: string): StepOutcome => ({ status: "SUCCEEDED", detail });
const NEEDS = (detail: string): StepOutcome => ({ status: "NEEDS_ACTION", detail });

/** Statuses a partir dos quais uma execução pode ser (re)iniciada. SUCCEEDED
 *  fica de fora de propósito: automação concluída nunca roda de novo. */
const CLAIMABLE: AutomationExecutionStatus[] = ["PENDING", "PARTIAL", "FAILED"];

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * `dueDate` de Receivable é DATE-ONLY: o resto do módulo financeiro corta o
 * mês em meia-noite UTC (ver o comentário longo em receivable-service.ts).
 * Somar dias com `new Date()` local geraria `2026-09-01T21:00:00Z` no fuso de
 * Brasília, que cai no mês certo por acidente e no errado perto da virada.
 * Aqui a data é sempre normalizada pra meia-noite UTC do dia calculado.
 */
export function dueDateFrom(base: Date, days: number): Date {
  const utcMidnight = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate());
  return new Date(utcMidnight + days * 24 * 60 * 60 * 1000);
}

/** Arredonda pra centavos inteiros -- entrada percentual quase nunca dá um
 *  número redondo (33% de 1.000,00 = 330,0000000000001 em float). */
function toCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Mensagem curta e sem segredo pra gravar em `error` (nunca stack, nunca
 *  payload do provedor de assinatura). */
function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Erro desconhecido.";
  return raw.slice(0, 500);
}

export interface PostSaleOnboardingDeps {
  automation: PostSaleAutomationRepository;
  contracts: ContractRepository;
  companies: CompanyRepository;
  leads: LeadRepository;
  memberships: MembershipRepository;
  pipelines: PipelineRepository;
  receivables: ReceivableRepository;
  leadService: LeadService;
  receivableService: ReceivableService;
  briefingService: BriefingService;
  projectChecklistService: ProjectChecklistService;
  taskService: TaskService;
  activityLogger: ActivityLogger;
  push: PushSender;
  queue: PostSaleQueue;
  /** URL pública do app Next -- usada só pra montar links nas descrições das
   *  tarefas (o CRM é login-only, então é link interno, não exposição). */
  webPublicUrl: string;
}

/**
 * Orquestrador da automação pós-fechamento: contrato ASSINADO -> lead ganho,
 * plano de recebimento, briefing, projeto e tarefas.
 *
 * Duas regras governam este service inteiro:
 *
 * 1. **A assinatura é fato consumado.** `trigger()` é chamado DEPOIS de o
 *    contrato já estar persistido como ASSINADO e nunca propaga erro --
 *    nenhuma falha aqui pode desfazer, atrasar ou "des-assinar" o contrato.
 *    O que falha vira etapa FAILED/NEEDS_ACTION visível na tela do contrato,
 *    com botão de reprocessar.
 * 2. **Nada é adivinhado.** Faltando configuração obrigatória, a etapa NÃO
 *    escolhe um valor plausível: registra NEEDS_ACTION e cria uma tarefa
 *    para uma pessoa decidir.
 */
export class PostSaleOnboardingService {
  constructor(private readonly deps: PostSaleOnboardingDeps) {}

  /**
   * Ponto de entrada do webhook. Best-effort TOTAL: qualquer erro (banco,
   * fila, configuração) é engolido depois de virar um evento na timeline do
   * contrato. Devolve a execução criada, ou null quando a automação está
   * desligada pra organização.
   */
  async trigger(contract: Contract): Promise<AutomationExecutionDetail | null> {
    try {
      const settings = await this.deps.automation.findSettings(contract.organizationId);
      if (!settings?.enabled) return null;

      const execution = await this.ensureExecution(contract, "WEBHOOK", null);
      await this.deps.contracts.addEvent(
        contract.id,
        contract.organizationId,
        "AUTOMACAO_ENFILEIRADA",
        "WEBHOOK",
        { executionId: execution.id },
      );
      await this.deps.queue.enqueue({
        executionId: execution.id,
        contractId: contract.id,
        organizationId: contract.organizationId,
      });
      return execution;
    } catch (err) {
      // A execução pode ter ficado PENDING sem job na fila -- é exatamente o
      // caso que o botão "Reprocessar" na tela do contrato resolve.
      console.error("post-sale: falha ao disparar a automação (assinatura preservada)", {
        contractId: contract.id,
        organizationId: contract.organizationId,
        err,
      });
      await this.deps.contracts
        .addEvent(contract.id, contract.organizationId, "AUTOMACAO_FALHA_DISPARO", "WEBHOOK", {
          motivo: errorMessage(err),
        })
        .catch(() => null);
      return null;
    }
  }

  /**
   * Reprocessamento manual (tela do contrato). Diferente do `trigger`, este
   * PROPAGA erro -- quem clicou precisa ver o motivo. Também é o caminho que
   * cria a execução retroativamente: contrato assinado antes de a automação
   * ser ligada não tem execução nenhuma até alguém pedir.
   */
  async reprocess(
    organizationId: string,
    contractId: string,
    userId: string | null,
  ): Promise<AutomationExecutionDetail> {
    const contract = await this.deps.contracts.findByIdForOrg(contractId, organizationId);
    if (!contract) throw new NotFoundError("Contrato não encontrado.");
    if (contract.status !== "ASSINADO") {
      throw new ValidationError(
        "A automação pós-fechamento só roda para contratos assinados.",
      );
    }

    const execution = await this.ensureExecution(contract, "MANUAL", userId);
    if (execution.status === "SUCCEEDED") {
      throw new ValidationError(
        "Esta automação já foi concluída com sucesso -- não há etapa pendente para reprocessar.",
      );
    }

    await this.deps.automation.setTrigger(execution.id, "MANUAL", userId);
    await this.deps.contracts.addEvent(
      contract.id,
      organizationId,
      "AUTOMACAO_REPROCESSADA",
      "ADMIN",
      { executionId: execution.id },
    );
    await this.deps.queue.enqueue({
      executionId: execution.id,
      contractId: contract.id,
      organizationId,
    });
    return (await this.deps.automation.findExecutionById(organizationId, execution.id))!;
  }

  getByContract(
    organizationId: string,
    contractId: string,
  ): Promise<AutomationExecutionDetail | null> {
    return this.deps.automation.findExecutionByContract(organizationId, contractId);
  }

  private ensureExecution(
    contract: Contract,
    triggeredBy: "WEBHOOK" | "MANUAL",
    triggeredById: string | null,
  ): Promise<AutomationExecutionDetail> {
    return this.deps.automation.ensureExecution({
      organizationId: contract.organizationId,
      contractId: contract.id,
      triggeredBy,
      triggeredById,
      // Payload seguro: só o que identifica o negócio. Nada de
      // contractorSnapshot (CPF/endereço), signatureDocId ou PDF.
      payload: {
        numero: contract.numero,
        valorTotal: contract.valorTotal,
        tipo: contract.tipo,
        assinadoEm: contract.assinadoEm?.toISOString() ?? null,
      },
    });
  }

  // =========================================================================
  // Execução (chamada pelo worker)
  // =========================================================================

  /**
   * Roda as etapas pendentes de uma execução. Idempotente em três níveis:
   * o CAS de status impede duas execuções paralelas, etapas SUCCEEDED nunca
   * rodam de novo, e cada artefato criado é registrado com chave única.
   */
  async run(organizationId: string, executionId: string): Promise<AutomationExecutionDetail> {
    // Lido ANTES do claim: depois dele o status já é RUNNING, e é a diferença
    // entre o desfecho anterior e o novo que decide se vale notificar.
    const before = await this.deps.automation.findExecutionById(organizationId, executionId);
    if (!before) throw new NotFoundError("Execução de automação não encontrada.");
    const previousStatus = before.status;

    const claimed = await this.deps.automation.claimExecution(executionId, CLAIMABLE, new Date());
    if (!claimed) {
      // Já está RUNNING (outro job/reprocessamento pegou primeiro) ou já
      // concluiu com sucesso. Nos dois casos não há nada a fazer aqui.
      return before;
    }

    const execution = await this.deps.automation.findExecutionById(organizationId, executionId);
    if (!execution) throw new NotFoundError("Execução de automação não encontrada.");

    const contract = await this.deps.contracts.findByIdForOrg(
      execution.contractId,
      organizationId,
    );
    if (!contract || contract.status !== "ASSINADO") {
      await this.deps.automation.finishExecution(
        executionId,
        "FAILED",
        new Date(),
        contract ? "Contrato não está assinado." : "Contrato não encontrado.",
      );
      return (await this.deps.automation.findExecutionById(organizationId, executionId))!;
    }

    const settings = await this.deps.automation.findSettings(organizationId);
    if (!settings) {
      await this.deps.automation.finishExecution(
        executionId,
        "FAILED",
        new Date(),
        "Automação pós-fechamento não configurada para esta organização.",
      );
      return (await this.deps.automation.findExecutionById(organizationId, executionId))!;
    }

    await this.deps.contracts.addEvent(
      contract.id,
      organizationId,
      "AUTOMACAO_INICIADA",
      "WORKER",
      { executionId },
    );

    const ctx: RunContext = {
      execution,
      contract,
      settings,
      organizationId,
      ownerId: await this.resolveOwner(organizationId, settings, contract),
    };

    // Cada etapa é isolada: um throw inesperado vira FAILED naquela etapa e
    // as seguintes continuam. Sem isso, uma falha em recebimentos impediria
    // o briefing e o projeto de existirem.
    await this.runStep(ctx, "LEAD_WON", () => this.stepLeadWon(ctx));
    await this.runStep(ctx, "RECEIVABLES", () => this.stepReceivables(ctx));
    await this.runStep(ctx, "BRIEFING", () => this.stepBriefing(ctx));
    await this.runStep(ctx, "PROJECT", () => this.stepProject(ctx));
    await this.runStep(ctx, "TASKS", () => this.stepTasks(ctx));

    const steps = await this.deps.automation.listSteps(executionId);
    const finalStatus = resolveExecutionStatus(steps.map((s) => s.status));
    await this.deps.automation.finishExecution(executionId, finalStatus, new Date(), null);

    await this.afterFinish(ctx, previousStatus, finalStatus);

    return (await this.deps.automation.findExecutionById(organizationId, executionId))!;
  }

  /**
   * Envolve uma etapa: pula as já concluídas, marca RUNNING, executa e grava
   * o desfecho. Etapas SKIPPED SÃO reavaliadas num reprocessamento -- se o
   * dono ligou "criar briefing" depois da primeira execução, o reprocesso
   * passa a criar (a etapa reexamina a configuração e ou faz, ou pula de
   * novo). SUCCEEDED nunca é reavaliada: é o que garante não duplicar.
   */
  private async runStep(
    ctx: RunContext,
    key: AutomationStepKey,
    fn: () => Promise<StepOutcome>,
  ): Promise<void> {
    const current = ctx.execution.steps.find((s) => s.key === key);
    if (current?.status === "SUCCEEDED") return;

    await this.deps.automation.updateStep(ctx.execution.id, key, {
      status: "RUNNING",
      startedAt: new Date(),
      error: null,
      incrementAttempts: true,
    });

    try {
      const outcome = await fn();
      await this.deps.automation.updateStep(ctx.execution.id, key, {
        status: outcome.status,
        detail: outcome.detail,
        error: outcome.error ?? null,
        finishedAt: new Date(),
      });
    } catch (err) {
      console.error("post-sale: etapa falhou (contrato segue assinado)", {
        executionId: ctx.execution.id,
        contractId: ctx.contract.id,
        step: key,
        err,
      });
      await this.deps.automation.updateStep(ctx.execution.id, key, {
        status: "FAILED",
        detail: "Falhou -- veja o motivo e use Reprocessar.",
        error: errorMessage(err),
        finishedAt: new Date(),
      });
    }
  }

  // ---- 5.1 Lead ----------------------------------------------------------

  private async stepLeadWon(ctx: RunContext): Promise<StepOutcome> {
    const { contract, settings, organizationId } = ctx;
    if (!contract.leadId) return SKIP("Contrato sem lead vinculado.");

    const lead = await this.deps.leads.findByIdForOrg(contract.leadId, organizationId);
    if (!lead) return SKIP("Lead do contrato não existe mais.");

    if (lead.status === "WON") {
      await this.recordArtifact(ctx, "LEAD_WON", "lead", "LEAD", lead.id, lead.title);
      return OK("Lead já estava marcado como ganho.");
    }

    if (!settings.wonStageId) {
      await this.ensureTask(ctx, "LEAD_WON", "task:pendencia-estagio-ganho", {
        title: "Configurar o estágio de ganho do pipeline",
        description:
          "A automação pós-fechamento não moveu o lead porque nenhum estágio de ganho está configurado. Defina em Configurações > Automação e reprocesse o contrato.",
        dueDays: 1,
      });
      return NEEDS("Nenhum estágio de ganho configurado -- lead não foi movido.");
    }

    // Revalida no momento da execução: o estágio pode ter sido apagado entre
    // a configuração e a assinatura. Mover pra um id inválido derrubaria a
    // etapa com NotFoundError -- pendência é resposta melhor que falha.
    const stage = await this.deps.pipelines.findStageForOrg(settings.wonStageId, organizationId);
    if (!stage || !stage.isWon) {
      await this.ensureTask(ctx, "LEAD_WON", "task:pendencia-estagio-ganho", {
        title: "Revisar o estágio de ganho do pipeline",
        description:
          "O estágio configurado para a automação não existe mais ou deixou de ser de ganho. Revise em Configurações > Automação e reprocesse o contrato.",
        dueDays: 1,
      });
      return NEEDS("Estágio de ganho configurado é inválido -- lead não foi movido.");
    }

    // moveStage é o service existente: decide status/closedAt por
    // isWon/isLost e grava a Activity STATUS_CHANGE na timeline do lead.
    await this.deps.leadService.moveStage(
      organizationId,
      // Sem responsável utilizável, a Activity fica sem autor (null) em vez
      // de atribuir a movimentação a quem criou o contrato por acidente.
      ctx.ownerId ?? null,
      lead.id,
      stage.id,
    );
    await this.recordArtifact(ctx, "LEAD_WON", "lead", "LEAD", lead.id, lead.title);
    return OK(`Lead movido para "${stage.name}" e marcado como ganho.`);
  }

  // ---- 5.2 Recebimentos --------------------------------------------------

  private async stepReceivables(ctx: RunContext): Promise<StepOutcome> {
    const { contract, settings, organizationId } = ctx;
    if (!settings.createReceivables) return SKIP("Criação automática de recebimentos desligada.");

    const existing = await this.deps.receivables.listByContract(organizationId, contract.id);
    if (existing.length > 0) {
      // Cobre os dois casos que a requisição separa: plano já criado (reenvio
      // do webhook) e plano com parcela paga (nunca recriar). `createPlan`
      // apagaria as parcelas em aberto pra recriar -- inaceitável aqui.
      const paid = existing.filter((r) => r.paidAt).length;
      await this.recordArtifact(
        ctx,
        "RECEIVABLES",
        "receivable-plan",
        "RECEIVABLE_PLAN",
        contract.id,
        `${existing.length} parcela(s)`,
      );
      return OK(
        paid > 0
          ? `Plano já existe (${existing.length} parcelas, ${paid} paga(s)) -- mantido como está.`
          : `Plano já existe (${existing.length} parcelas) -- nada a criar.`,
      );
    }

    const missing: string[] = [];
    if (settings.installmentCount == null) missing.push("número de parcelas");
    if (settings.entryDueDays == null) missing.push("prazo da entrada");
    if (settings.firstInstallmentDueDays == null) missing.push("prazo da 1ª parcela");
    const total = Number(contract.valorTotal);
    if (!Number.isFinite(total) || total <= 0) missing.push("valor do contrato");

    if (missing.length > 0) {
      await this.ensureTask(ctx, "RECEIVABLES", "task:definir-plano-recebimento", {
        title: "Definir plano de recebimento",
        description: `Faltou configuração para gerar o plano automaticamente (${missing.join(", ")}). Monte as parcelas do contrato ${contract.numero} à mão.\n${this.contractLink(contract.id)}`,
        dueDays: 2,
      });
      return NEEDS(`Configuração financeira incompleta: ${missing.join(", ")}.`);
    }

    const signedAt = contract.assinadoEm ?? new Date();
    const entryAmount = toCents((total * Number(contract.percentualEntrada)) / 100);
    // Entrada de 100% não tem parcela seguinte -- buildPlan recusaria
    // `installmentCount >= 1` combinado com entrada == total.
    const installmentCount = entryAmount >= total ? 0 : settings.installmentCount!;

    let items;
    try {
      items = buildPlan({
        total,
        entryAmount,
        installmentCount,
        entryDueDate: dueDateFrom(signedAt, settings.entryDueDays!),
        firstDueDate: dueDateFrom(signedAt, settings.firstInstallmentDueDays!),
      });
    } catch (err) {
      // RangeError do builder = combinação impossível (ex.: 0 parcelas com
      // entrada parcial). É pendência, não falha de sistema.
      await this.ensureTask(ctx, "RECEIVABLES", "task:definir-plano-recebimento", {
        title: "Definir plano de recebimento",
        description: `A automação não conseguiu montar o plano do contrato ${contract.numero}: ${errorMessage(err)}. Monte as parcelas à mão.\n${this.contractLink(contract.id)}`,
        dueDays: 2,
      });
      return NEEDS(`Composição de parcelas inválida: ${errorMessage(err)}`);
    }

    // createPlan revalida a soma contra o valor do contrato e recusa recriar
    // sobre parcela paga -- não duplicamos essas regras aqui.
    const created = await this.deps.receivableService.createPlan(organizationId, {
      contractId: contract.id,
      total,
      entryAmount,
      entryDueDate: items.find((i) => i.kind === "ENTRADA")?.dueDate ?? dueDateFrom(signedAt, 0),
      installments: items
        .filter((i) => i.kind === "PARCELA")
        .map((i) => ({ amount: i.amount, dueDate: i.dueDate })),
    });

    await this.recordArtifact(
      ctx,
      "RECEIVABLES",
      "receivable-plan",
      "RECEIVABLE_PLAN",
      contract.id,
      `${created.length} parcela(s)`,
    );
    if (contract.leadId) {
      await this.deps.activityLogger.log(organizationId, contract.leadId, null, "OTHER", {
        kind: "post_sale_receivables_created",
        contractId: contract.id,
        count: created.length,
      });
    }
    return OK(
      `Plano criado: ${entryAmount > 0 ? `entrada de ${BRL.format(entryAmount)} + ` : ""}${installmentCount} parcela(s).`,
    );
  }

  // ---- 5.3 Briefing ------------------------------------------------------

  private async stepBriefing(ctx: RunContext): Promise<StepOutcome> {
    const { contract, settings, organizationId } = ctx;
    if (!settings.createBriefing) return SKIP("Criação automática de briefing desligada.");

    const alreadyLinked = await this.deps.briefingService.findByContract(
      organizationId,
      contract.id,
    );
    if (alreadyLinked) {
      await this.recordArtifact(
        ctx,
        "BRIEFING",
        "briefing",
        "BRIEFING",
        alreadyLinked.id,
        "Briefing do contrato",
      );
      return OK("Briefing deste contrato já existe.");
    }

    if (!settings.briefingTemplateKey) {
      await this.ensureTask(ctx, "BRIEFING", "task:selecionar-briefing", {
        title: "Selecionar e enviar briefing",
        description: `Nenhum template padrão de briefing está configurado. Escolha o formulário certo para o contrato ${contract.numero} e envie ao cliente.\n${this.contractLink(contract.id)}`,
        dueDays: 2,
      });
      return NEEDS("Nenhum template padrão de briefing configurado.");
    }

    const briefing = await this.deps.briefingService.create(
      organizationId,
      ctx.ownerId ?? null,
      {
        templateKey: settings.briefingTemplateKey,
        leadId: contract.leadId,
        companyId: contract.companyId,
        contractId: contract.id,
      },
    );

    await this.recordArtifact(
      ctx,
      "BRIEFING",
      "briefing",
      "BRIEFING",
      briefing.id,
      "Briefing do contrato",
    );

    // Push pra equipe interna. NÃO enviamos nada ao cliente: o link público
    // fica pronto e quem envia é uma pessoa, pelo canal que ela escolher.
    void this.deps.push
      .sendToOrg(organizationId, {
        title: "📋 Briefing pronto pra enviar",
        body: `Contrato ${contract.numero} assinado — o briefing já está criado.`,
        url: `/briefings/${briefing.id}`,
      })
      .catch(() => null);

    return OK("Briefing criado com link público, pronto pra enviar.");
  }

  // ---- 5.4 Projeto -------------------------------------------------------

  private async stepProject(ctx: RunContext): Promise<StepOutcome> {
    const { contract, settings, organizationId } = ctx;
    if (!settings.createProject) return SKIP("Criação automática de projeto desligada.");

    const existing = await this.deps.projectChecklistService.findByContract(
      organizationId,
      contract.id,
    );
    if (existing) {
      await this.recordArtifact(
        ctx,
        "PROJECT",
        "project",
        "PROJECT_CHECKLIST",
        existing.id,
        existing.name,
      );
      return OK("Projeto deste contrato já existe.");
    }

    if (!settings.projectType) {
      await this.ensureTask(ctx, "PROJECT", "task:preparar-projeto", {
        title: "Preparar o projeto",
        description: `Nenhum tipo padrão de projeto está configurado (institucional ou sistema). Crie o checklist do contrato ${contract.numero} à mão.\n${this.contractLink(contract.id)}`,
        dueDays: 3,
      });
      return NEEDS("Nenhum tipo padrão de projeto configurado.");
    }

    const company = await this.deps.companies.findByIdForOrg(contract.companyId, organizationId);
    const name = `${company?.name ?? "Cliente"} — ${contract.numero}`;
    // Início e prazo saem do próprio contrato assinado -- dado confiável, não
    // estimativa. Sem `assinadoEm` (contrato marcado ASSINADO por caminho
    // manual antigo) os dois ficam nulos em vez de chutar "hoje".
    const startedAt = contract.assinadoEm;
    const dueAt = startedAt ? dueDateFrom(startedAt, contract.prazoEntregaDias) : null;

    const project = await this.deps.projectChecklistService.create(organizationId, {
      name,
      type: settings.projectType,
      companyId: contract.companyId,
      leadId: contract.leadId,
      contractId: contract.id,
      startedAt,
      dueAt,
    });

    await this.recordArtifact(ctx, "PROJECT", "project", "PROJECT_CHECKLIST", project.id, name);
    if (contract.leadId) {
      await this.deps.activityLogger.log(organizationId, contract.leadId, null, "OTHER", {
        kind: "post_sale_project_created",
        contractId: contract.id,
        projectChecklistId: project.id,
      });
    }
    return OK(`Projeto "${name}" criado com ${project.phases.length} fases.`);
  }

  // ---- 5.5 Próximas tarefas ---------------------------------------------

  private async stepTasks(ctx: RunContext): Promise<StepOutcome> {
    const { contract, organizationId } = ctx;
    const created: string[] = [];

    const hasPlan =
      (await this.deps.receivables.listByContract(organizationId, contract.id)).length > 0;
    const briefing = await this.deps.automation.findArtifact(ctx.execution.id, "briefing");
    const project = await this.deps.automation.findArtifact(ctx.execution.id, "project");

    if (hasPlan) {
      const entryDue = ctx.settings.entryDueDays ?? 3;
      if (
        await this.ensureTask(ctx, "TASKS", "task:confirmar-entrada", {
          title: `Confirmar pagamento da entrada — ${contract.numero}`,
          description: `Confirme a entrada do contrato ${contract.numero} e dê baixa na parcela.\n${this.link(`/receivables`)}`,
          dueDays: entryDue,
        })
      ) {
        created.push("confirmar entrada");
      }
    }

    if (briefing) {
      if (
        await this.ensureTask(ctx, "TASKS", "task:revisar-briefing", {
          title: `Revisar e enviar o briefing — ${contract.numero}`,
          description: `O briefing foi criado automaticamente. Revise as perguntas e envie o link público ao cliente.\n${this.link(`/briefings/${briefing.refId}`)}`,
          dueDays: 2,
        })
      ) {
        created.push("revisar briefing");
      }
    }

    if (
      await this.ensureTask(ctx, "TASKS", "task:kickoff", {
        title: `Preparar kickoff — ${contract.numero}`,
        description: `Agende a reunião de início do projeto com o cliente.\n${this.contractLink(contract.id)}`,
        dueDays: 3,
      })
    ) {
      created.push("kickoff");
    }

    if (project) {
      if (
        await this.ensureTask(ctx, "TASKS", "task:validar-prazo", {
          title: `Validar o prazo do projeto — ${contract.numero}`,
          description: `O prazo veio do contrato (${contract.prazoEntregaDias} dias). Confirme se é executável com a agenda atual.\n${this.link(`/projetos/${project.refId}`)}`,
          dueDays: 2,
        })
      ) {
        created.push("validar prazo");
      }
      if (
        await this.ensureTask(ctx, "TASKS", "task:iniciar-fase-1", {
          title: `Iniciar a primeira fase — ${contract.numero}`,
          description: `Marque a fase 1 do checklist como em andamento quando o trabalho começar.\n${this.link(`/projetos/${project.refId}`)}`,
          dueDays: 5,
        })
      ) {
        created.push("iniciar fase 1");
      }
    }

    if (created.length === 0) return OK("Nenhuma tarefa nova (todas já existiam).");
    if (contract.leadId) {
      await this.deps.activityLogger.log(organizationId, contract.leadId, null, "TASK_CREATED", {
        kind: "post_sale_tasks_created",
        contractId: contract.id,
        tasks: created,
      });
    }
    return OK(`${created.length} tarefa(s) criada(s): ${created.join(", ")}.`);
  }

  // ---- Auxiliares --------------------------------------------------------

  /**
   * Cria a tarefa só se o artefato daquela chave ainda não existir. É esta
   * checagem (+ o unique de `automation_artifacts`) que garante que reenviar
   * o webhook cinco vezes não gera cinco "Preparar kickoff".
   * Devolve `true` se criou agora, `false` se já existia.
   */
  private async ensureTask(
    ctx: RunContext,
    stepKey: AutomationStepKey,
    key: string,
    input: { title: string; description: string; dueDays: number },
  ): Promise<boolean> {
    const existing = await this.deps.automation.findArtifact(ctx.execution.id, key);
    if (existing) return false;

    const task = await this.deps.taskService.create(ctx.organizationId, {
      title: input.title,
      description: input.description,
      leadId: ctx.contract.leadId ?? undefined,
      assigneeId: ctx.ownerId,
      dueAt: dueDateFrom(ctx.contract.assinadoEm ?? new Date(), input.dueDays),
    });
    await this.recordArtifact(ctx, stepKey, key, "TASK", task.id, input.title);
    return true;
  }

  private recordArtifact(
    ctx: RunContext,
    stepKey: AutomationStepKey,
    key: string,
    type: "LEAD" | "RECEIVABLE_PLAN" | "BRIEFING" | "PROJECT_CHECKLIST" | "TASK",
    refId: string,
    label: string | null,
  ) {
    return this.deps.automation.recordArtifact({
      organizationId: ctx.organizationId,
      executionId: ctx.execution.id,
      stepKey,
      key,
      type,
      refId,
      label,
    });
  }

  /**
   * Escolhe o responsável das tarefas/briefing desta execução: o padrão
   * configurado, senão quem criou o contrato -- e só se a pessoa ainda for
   * membro ativo. Um `defaultOwnerId` é validado ao ser salvo, mas nada
   * impede a pessoa de ser suspensa depois; esta checagem é no momento do
   * uso, que é o único que importa.
   */
  private async resolveOwner(
    organizationId: string,
    settings: PostSaleAutomationSettings,
    contract: Contract,
  ): Promise<string | undefined> {
    for (const candidate of [settings.defaultOwnerId, contract.createdById]) {
      if (!candidate) continue;
      if (await this.deps.memberships.isActiveMember(candidate, organizationId)) return candidate;
    }
    return undefined;
  }

  private link(path: string): string {
    return `${this.deps.webPublicUrl}${path}`;
  }

  private contractLink(contractId: string): string {
    return this.link(`/contracts/${contractId}`);
  }

  /** Timeline do contrato + push -- só quando o desfecho MUDA, pra não
   *  notificar de novo um reprocessamento que terminou igual. */
  private async afterFinish(
    ctx: RunContext,
    previousStatus: AutomationExecutionStatus,
    finalStatus: AutomationExecutionStatus,
  ): Promise<void> {
    const evento =
      finalStatus === "SUCCEEDED"
        ? "AUTOMACAO_CONCLUIDA"
        : finalStatus === "PARTIAL"
          ? "AUTOMACAO_PARCIAL"
          : "AUTOMACAO_FALHOU";
    await this.deps.contracts
      .addEvent(ctx.contract.id, ctx.organizationId, evento, "WORKER", {
        executionId: ctx.execution.id,
      })
      .catch(() => null);

    if (previousStatus === finalStatus) return;

    const titulo =
      finalStatus === "SUCCEEDED"
        ? "🚀 Pós-fechamento concluído"
        : finalStatus === "PARTIAL"
          ? "⚠️ Pós-fechamento com pendências"
          : "❌ Pós-fechamento falhou";
    void this.deps.push
      .sendToOrg(ctx.organizationId, {
        title: titulo,
        body: `Contrato ${ctx.contract.numero}`,
        url: `/contracts/${ctx.contract.id}`,
      })
      .catch(() => null);
  }
}

interface RunContext {
  execution: AutomationExecutionDetail;
  contract: Contract;
  settings: PostSaleAutomationSettings;
  organizationId: string;
  /**
   * Responsável já resolvido e VALIDADO para esta execução, ou `undefined`
   * quando não há um utilizável.
   *
   * `TaskService.create` recusa (ValidationError) um `assigneeId` que não
   * seja membro ativo. Sem esta resolução prévia, um responsável padrão
   * suspenso depois de configurado -- ou um `createdById` de alguém que
   * saiu da equipe -- derrubaria a etapa de tarefas INTEIRA. Tarefa sem
   * responsável é muito melhor que nenhuma tarefa.
   */
  ownerId: string | undefined;
}

/**
 * Desfecho da execução a partir dos desfechos das etapas. Pura pra ser
 * testável sem banco.
 *
 * - Etapas SKIPPED são ignoradas: desligar briefing na configuração não pode
 *   fazer a automação parecer "parcial".
 * - Tudo pulado (automação ligada, todas as sub-opções desligadas) conta como
 *   sucesso -- foi exatamente o que se pediu que acontecesse.
 */
export function resolveExecutionStatus(
  statuses: AutomationStepStatus[],
): AutomationExecutionStatus {
  const relevant = statuses.filter((s) => s !== "SKIPPED");
  if (relevant.length === 0) return "SUCCEEDED";
  if (relevant.every((s) => s === "SUCCEEDED")) return "SUCCEEDED";
  if (relevant.every((s) => s === "FAILED")) return "FAILED";
  return "PARTIAL";
}
