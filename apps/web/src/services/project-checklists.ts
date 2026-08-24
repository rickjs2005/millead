import { api } from "./api-client";
import type {
  ProjectChecklistDetail,
  ProjectChecklistPhase,
  ProjectChecklistPhaseStatus,
  ProjectChecklistSummary,
  ProjectChecklistType,
} from "@/types/api";

export interface CreateProjectChecklistPayload {
  name: string;
  type: ProjectChecklistType;
  companyId?: string;
  localFolder?: string;
}

export interface UpdatePhaseStatusPayload {
  status: ProjectChecklistPhaseStatus;
  naNote?: string;
}

export const projectChecklistsService = {
  list: () => api.get<ProjectChecklistSummary[]>("/api/v1/project-checklists"),

  get: (id: string) => api.get<ProjectChecklistDetail>(`/api/v1/project-checklists/${id}`),

  create: (payload: CreateProjectChecklistPayload) =>
    api.post<ProjectChecklistDetail>("/api/v1/project-checklists", payload),

  delete: (id: string) => api.delete<void>(`/api/v1/project-checklists/${id}`),

  updatePhaseStatus: (id: string, phaseNumber: number, payload: UpdatePhaseStatusPayload) =>
    api.patch<ProjectChecklistPhase>(`/api/v1/project-checklists/${id}/phases/${phaseNumber}`, payload),
};
