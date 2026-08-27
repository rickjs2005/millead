import type { ProjectChecklistPhaseStatus, ProjectChecklistType } from "@millead/database";
import type {
  ProjectChecklistDetail,
  ProjectChecklistPhase,
  ProjectChecklistSummary,
} from "../entities/project-checklist.js";

export interface CreateProjectChecklistInput {
  organizationId: string;
  name: string;
  type: ProjectChecklistType;
  companyId?: string | null;
  /** Preenchidos só pela automação pós-fechamento -- a criação manual (DTO
   *  HTTP) não expõe nenhum dos quatro. */
  leadId?: string | null;
  contractId?: string | null;
  startedAt?: Date | null;
  dueAt?: Date | null;
  localFolder?: string | null;
}

export interface UpdatePhaseStatusInput {
  status: ProjectChecklistPhaseStatus;
  naNote?: string | null;
}

export interface ProjectChecklistRepository {
  /** `phaseNames` já vem na ordem 1..N -- a implementação semeia phaseNumber = index + 1. */
  create(
    input: CreateProjectChecklistInput,
    phaseNames: string[],
  ): Promise<ProjectChecklistDetail>;
  findByIdForOrg(id: string, organizationId: string): Promise<ProjectChecklistDetail | null>;
  /** Projeto já criado a partir deste contrato (o `@@unique(contractId)` do
   *  banco garante que é no máximo um). */
  findByContractId(
    organizationId: string,
    contractId: string,
  ): Promise<ProjectChecklistDetail | null>;
  list(organizationId: string): Promise<ProjectChecklistSummary[]>;
  delete(id: string, organizationId: string): Promise<boolean>;
  updatePhaseStatus(
    projectChecklistId: string,
    organizationId: string,
    phaseNumber: number,
    input: UpdatePhaseStatusInput,
  ): Promise<ProjectChecklistPhase | null>;
}
