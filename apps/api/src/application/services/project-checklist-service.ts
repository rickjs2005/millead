import type { ProjectChecklistPhaseStatus } from "@millead/database";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { LeadRepository } from "../../domain/repositories/lead-repository.js";
import type {
  CreateProjectChecklistInput,
  ProjectChecklistRepository,
  UpdatePhaseStatusInput,
} from "../../domain/repositories/project-checklist-repository.js";

/** Copiado literalmente dos headers "## Fase NN" da skill site-institucional (SKILL.md). */
export const INSTITUTIONAL_PHASE_NAMES = [
  "Briefing e descoberta",
  "Arquitetura do site",
  "UX",
  "UI / Design",
  "Conteúdo",
  "Frontend",
  "Motion Design",
  "SEO On-Page",
  "Performance",
  "Acessibilidade",
  "Analytics e conversão",
  "Segurança",
  "QA",
  "Deploy",
  "Indexação",
  "Entrega",
] as const;

/** Copiado literalmente dos headers "## Fase NN" da skill sistema-web (SKILL.md). */
export const SYSTEM_PHASE_NAMES = [
  "Descoberta e arquitetura",
  "UX/UI",
  "Modelagem do banco",
  "Backend",
  "Autenticação e autorização (RBAC)",
  "Frontend",
  "Integrações",
  "Segurança",
  "Testes",
  "Performance",
  "Observabilidade",
  "Infraestrutura",
  "QA final",
  "Deploy",
  "SEO para páginas públicas",
  "Pós-lançamento",
] as const;

export const PHASE_TEMPLATES = {
  INSTITUTIONAL: INSTITUTIONAL_PHASE_NAMES,
  SYSTEM: SYSTEM_PHASE_NAMES,
} as const;

/**
 * Progresso 0-100: fases DONE + NOT_APPLICABLE contam como concluídas sobre
 * o total de fases. Função pura (sem I/O) pra ser testável sem banco --
 * tanto o repositório Prisma quanto este service chamam a mesma implementação
 * em vez de duplicar a conta em duas camadas.
 */
export function computeProgressPercent(phases: { status: ProjectChecklistPhaseStatus }[]): number {
  if (phases.length === 0) return 0;
  const done = phases.filter((p) => p.status === "DONE" || p.status === "NOT_APPLICABLE").length;
  return Math.round((done / phases.length) * 100);
}

export class ProjectChecklistService {
  constructor(
    private readonly projectChecklists: ProjectChecklistRepository,
    private readonly companies: CompanyRepository,
    private readonly leads: LeadRepository,
    private readonly contracts: ContractRepository,
  ) {}

  async create(
    organizationId: string,
    input: Omit<CreateProjectChecklistInput, "organizationId">,
  ) {
    // companyId/leadId/contractId cruzam tenant se não validados: a FK só
    // garante que a linha existe, não que pertence à mesma organização de
    // quem está criando o checklist -- sem isso, qualquer chamador poderia
    // linkar um checklist a uma Company/Lead/Contract de outro tenant.
    // O DTO HTTP só expõe companyId (Zod descarta o resto), então os outros
    // dois só chegam pela automação pós-fechamento -- que também não pode
    // errar isso em silêncio.
    if (input.companyId) {
      const company = await this.companies.findByIdForOrg(input.companyId, organizationId);
      if (!company) throw new NotFoundError("Empresa não encontrada.");
    }
    if (input.leadId) {
      const lead = await this.leads.findByIdForOrg(input.leadId, organizationId);
      if (!lead) throw new NotFoundError("Lead não encontrado.");
    }
    if (input.contractId) {
      const contract = await this.contracts.findByIdForOrg(input.contractId, organizationId);
      if (!contract) throw new NotFoundError("Contrato não encontrado.");
    }
    const phaseNames = PHASE_TEMPLATES[input.type];
    return this.projectChecklists.create({ organizationId, ...input }, [...phaseNames]);
  }

  /** Projeto já gerado a partir de um contrato (idempotência da automação). */
  findByContract(organizationId: string, contractId: string) {
    return this.projectChecklists.findByContractId(organizationId, contractId);
  }

  async list(organizationId: string) {
    return this.projectChecklists.list(organizationId);
  }

  async get(organizationId: string, id: string) {
    const checklist = await this.projectChecklists.findByIdForOrg(id, organizationId);
    if (!checklist) throw new NotFoundError("Checklist de projeto não encontrado.");
    return checklist;
  }

  async delete(organizationId: string, id: string) {
    const deleted = await this.projectChecklists.delete(id, organizationId);
    if (!deleted) throw new NotFoundError("Checklist de projeto não encontrado.");
  }

  async updatePhaseStatus(
    organizationId: string,
    projectChecklistId: string,
    phaseNumber: number,
    input: UpdatePhaseStatusInput,
  ) {
    if (input.status === "NOT_APPLICABLE" && !input.naNote) {
      throw new ValidationError("naNote é obrigatório quando o status é NOT_APPLICABLE.");
    }
    const phase = await this.projectChecklists.updatePhaseStatus(
      projectChecklistId,
      organizationId,
      phaseNumber,
      input,
    );
    if (!phase) throw new NotFoundError("Fase não encontrada.");
    return phase;
  }
}
