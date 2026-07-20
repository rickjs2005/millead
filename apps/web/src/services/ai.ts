import { api } from "./api-client";
import type {
  AiStatus,
  LeadReportResponse,
  LeadScoreResponse,
  Message,
  MessageChannel,
} from "@/types/api";

export interface DraftMessagePayload {
  channel: MessageChannel;
  templateId?: string;
  instructions?: string;
}

/**
 * Recursos de IA (Fase 7). Sem ANTHROPIC_API_KEY no backend, todos exceto
 * `status` respondem 503 -- a UI checa `status` e desabilita os botões.
 */
export const aiService = {
  status: () => api.get<AiStatus>("/api/v1/ai/status"),

  scoreLead: (leadId: string) => api.post<LeadScoreResponse>(`/api/v1/ai/leads/${leadId}/score`),

  reportLead: (leadId: string) => api.post<LeadReportResponse>(`/api/v1/ai/leads/${leadId}/report`),

  draftMessage: (leadId: string, payload: DraftMessagePayload) =>
    api.post<Message>(`/api/v1/ai/leads/${leadId}/message`, payload),
};
