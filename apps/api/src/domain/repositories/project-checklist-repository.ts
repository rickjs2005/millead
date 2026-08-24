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
  list(organizationId: string): Promise<ProjectChecklistSummary[]>;
  delete(id: string, organizationId: string): Promise<boolean>;
  updatePhaseStatus(
    projectChecklistId: string,
    organizationId: string,
    phaseNumber: number,
    input: UpdatePhaseStatusInput,
  ): Promise<ProjectChecklistPhase | null>;
}
