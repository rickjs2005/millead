import { api } from "./api-client";
import type {
  AutomationExecution,
  PendingAutomation,
  PostSaleSettingsResult,
  ProjectChecklistType,
} from "@/types/api";

/** `null` explícito limpa o campo; ausente não mexe -- espelha o DTO da API
 *  (`updatePostSaleSettingsSchema`). */
export interface UpdatePostSaleSettingsPayload {
  enabled?: boolean;
  wonStageId?: string | null;
  briefingTemplateKey?: string | null;
  projectType?: ProjectChecklistType | null;
  defaultOwnerId?: string | null;
  createReceivables?: boolean;
  installmentCount?: number | null;
  entryDueDays?: number | null;
  firstInstallmentDueDays?: number | null;
  createBriefing?: boolean;
  createProject?: boolean;
}

export const postSaleService = {
  getSettings: () => api.get<PostSaleSettingsResult>("/api/v1/settings/post-sale-automation"),

  updateSettings: (payload: UpdatePostSaleSettingsPayload) =>
    api.patch<PostSaleSettingsResult>("/api/v1/settings/post-sale-automation", payload),

  /** `execution` vem null quando o contrato nunca disparou a automação -- é
   *  200 com corpo vazio, não 404. */
  getExecution: (contractId: string) =>
    api.get<{ execution: AutomationExecution | null }>(
      `/api/v1/contracts/${contractId}/post-sale`,
    ),

  /** Automações paradas da organização (painel). */
  listPending: () =>
    api.get<{ items: PendingAutomation[] }>("/api/v1/contracts/post-sale/pending"),

  reprocess: (contractId: string) =>
    api.post<{ execution: AutomationExecution }>(
      `/api/v1/contracts/${contractId}/post-sale/reprocess`,
    ),
};
