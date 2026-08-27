import type { ProjectChecklistPhaseStatus, ProjectChecklistType } from "@millead/database";

export interface ProjectChecklist {
  id: string;
  organizationId: string;
  name: string;
  type: ProjectChecklistType;
  companyId: string | null;
  /** Lead e contrato de origem: só a automação pós-fechamento preenche;
   *  checklists criados à mão continuam com os dois nulos. */
  leadId: string | null;
  contractId: string | null;
  localFolder: string | null;
  /** Início e prazo estimado -- derivados do contrato assinado
   *  (assinadoEm + prazoEntregaDias), nunca chutados. */
  startedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectChecklistPhase {
  id: string;
  projectChecklistId: string;
  phaseNumber: number;
  phaseName: string;
  status: ProjectChecklistPhaseStatus;
  naNote: string | null;
  updatedAt: Date;
}

export interface ProjectChecklistDetail extends ProjectChecklist {
  phases: ProjectChecklistPhase[];
  /** Progresso 0-100, DONE + NOT_APPLICABLE contam como concluídas sobre as
   * 16 fases -- mesma conta de ProjectChecklistSummary, calculada por
   * `computeProgressPercent` (application/services/project-checklist-service.ts). */
  progressPercent: number;
}

/** Usado na listagem: progresso 0-100, DONE + NOT_APPLICABLE contam como concluídas sobre as 16 fases. */
export interface ProjectChecklistSummary extends ProjectChecklist {
  progressPercent: number;
}
