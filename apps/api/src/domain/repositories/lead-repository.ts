import type { LeadSource, LeadStatus } from "@millead/database";
import type { Lead, LeadContact, LeadDetail, LeadNote } from "../entities/lead.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateLeadInput {
  organizationId: string;
  companyId?: string | null;
  pipelineStageId?: string | null;
  ownerId?: string | null;
  title: string;
  source?: LeadSource;
  value?: string | null;
  currency?: string;
}

export interface UpdateLeadInput {
  title?: string;
  companyId?: string | null;
  ownerId?: string | null;
  value?: string | null;
  currency?: string;
  lostReason?: string | null;
}

export interface MoveStageInput {
  pipelineStageId: string;
  status: LeadStatus;
  closedAt: Date | null;
}

export interface LeadFilters {
  status?: LeadStatus;
  pipelineStageId?: string;
  ownerId?: string;
  companyId?: string;
  /** Busca livre por título. */
  search?: string;
}

/**
 * Reunião/proposta/mensagem são `onDelete: Restrict` no schema (ver
 * comentário no model Lead) -- apagar precisa checar isso ANTES de tentar,
 * pra devolver "existem 2 reuniões vinculadas" em vez de deixar o Postgres
 * estourar uma violação de FK crua.
 */
export type DeleteLeadResult =
  | { status: "deleted" }
  | { status: "not_found" }
  | { status: "blocked"; meetings: number; proposals: number; messages: number };

/**
 * Resumo financeiro dos leads ganhos. `wonWithoutContract*` exclui leads
 * com contrato ASSINADO vinculado -- esses já entram na receita pelo KPI de
 * contratos (`valorFechado`), então somar os dois lados nunca conta a mesma
 * venda duas vezes.
 */
export interface LeadFinance {
  wonCount: number;
  /** Soma de `value` de todos os leads WON (Decimal serializado). */
  wonSum: string;
  wonWithoutContractCount: number;
  /** Soma de `value` dos WON sem contrato assinado vinculado. */
  wonWithoutContractSum: string;
}

export interface LeadRepository {
  create(input: CreateLeadInput): Promise<Lead>;
  findByIdForOrg(id: string, organizationId: string): Promise<LeadDetail | null>;
  list(
    organizationId: string,
    filters: LeadFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Lead>>;
  update(id: string, organizationId: string, patch: UpdateLeadInput): Promise<Lead | null>;
  delete(id: string, organizationId: string): Promise<DeleteLeadResult>;
  moveStage(id: string, organizationId: string, input: MoveStageInput): Promise<Lead | null>;
  finance(organizationId: string): Promise<LeadFinance>;
  /** Grava o score de oportunidade calculado pela IA (0-100). */
  updateScore(id: string, organizationId: string, score: number): Promise<Lead | null>;

  addContact(
    leadId: string,
    organizationId: string,
    input: { name: string; role?: string; email?: string; phone?: string; isPrimary?: boolean },
  ): Promise<LeadContact | null>;
  removeContact(id: string, leadId: string, organizationId: string): Promise<boolean>;

  addNote(
    leadId: string,
    organizationId: string,
    authorId: string | null,
    body: string,
  ): Promise<LeadNote | null>;

  /** Garante que a tag pertence à mesma org antes de vincular -- devolve false se lead ou tag não existirem/forem de outra org. */
  addTag(leadId: string, tagId: string, organizationId: string): Promise<boolean>;
  removeTag(leadId: string, tagId: string, organizationId: string): Promise<boolean>;
}
