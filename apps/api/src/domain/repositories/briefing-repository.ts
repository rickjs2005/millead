import type { BriefingStatus } from "@millead/database";
import type { Briefing, BriefingDetail, BriefingLink } from "../entities/briefing.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateBriefingInput {
  organizationId: string;
  templateId: string;
  leadId?: string | null;
  companyId?: string | null;
  createdById?: string | null;
  /** Token público já gerado pela camada de aplicação (aleatório, curto). */
  token: string;
}

export interface BriefingFilters {
  status?: BriefingStatus;
  /** Busca por contactName/contactEmail. */
  search?: string;
  leadId?: string;
}

export interface UpdateContactInput {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

/**
 * Dono do agregado Briefing: cria/lê/lista o Briefing, seu BriefingLink
 * (1:1) e o BriefingHistory (timeline) -- mesmo padrão do ContractRepository
 * cuidando de ContractSigner/ContractEvent internamente, sem repositório
 * próprio pra cada tabela filha do agregado.
 */
export interface BriefingRepository {
  /** Cria o Briefing e seu BriefingLink numa transação; grava histórico "CRIADO". */
  create(input: CreateBriefingInput): Promise<Briefing & { link: BriefingLink }>;
  findByIdForOrg(id: string, organizationId: string): Promise<BriefingDetail | null>;
  /** Resolve pelo token do link público -- null se não existe OU revogado.
   * NUNCA aceitar briefingId cru vindo do formulário público; só o token. */
  findByToken(token: string): Promise<BriefingDetail | null>;
  list(
    organizationId: string,
    filters: BriefingFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Briefing>>;
  updateStatus(
    id: string,
    status: BriefingStatus,
    extra?: { startedAt?: Date; completedAt?: Date; archivedAt?: Date },
  ): Promise<Briefing | null>;
  /** Transição atômica p/ COMPLETED só se ainda não concluído/arquivado.
   * Retorna null quando OUTRA chamada concorrente já concluiu (não reprocessa). */
  markCompleted(id: string, completedAt: Date): Promise<Briefing | null>;
  updateProgress(id: string, progressPercent: number): Promise<void>;
  updateContact(id: string, contact: UpdateContactInput): Promise<void>;
  setPdfUrl(id: string, pdfUrl: string): Promise<void>;
  /** Novo Briefing PENDING com mesmo template/lead/company + link próprio (token já gerado pelo service). */
  duplicate(
    id: string,
    organizationId: string,
    createdById: string | null,
    token: string,
  ): Promise<Briefing & { link: BriefingLink }>;
  revokeLink(briefingId: string, organizationId: string): Promise<void>;
  addHistory(
    briefingId: string,
    organizationId: string,
    tipo: string,
    origem: "APP" | "PUBLIC_FORM" | "WORKER",
    payload?: unknown,
  ): Promise<void>;
}
