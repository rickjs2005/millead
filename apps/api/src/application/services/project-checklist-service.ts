import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
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

export class ProjectChecklistService {
  constructor(private readonly projectChecklists: ProjectChecklistRepository) {}

  async create(
    organizationId: string,
    input: Omit<CreateProjectChecklistInput, "organizationId">,
  ) {
    const phaseNames = PHASE_TEMPLATES[input.type];
    return this.projectChecklists.create({ organizationId, ...input }, [...phaseNames]);
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
