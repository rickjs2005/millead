import type { BriefingAnswer } from "../entities/briefing.js";

export interface UpsertAnswerInput {
  organizationId: string;
  briefingId: string;
  fieldId: string;
  /** "" para campo de topo -- ver comentário no schema.prisma. */
  groupItemId?: string;
  groupItemOrder?: number | null;
  valueText?: string | null;
  valueJson?: unknown;
}

export interface BriefingAnswerRepository {
  /** Upsert atômico por [briefingId, fieldId, groupItemId] -- autosave idempotente. */
  upsert(input: UpsertAnswerInput): Promise<BriefingAnswer>;
  listForBriefing(briefingId: string, organizationId: string): Promise<BriefingAnswer[]>;
  /** Remove todas as respostas de um item de grupo (qualquer campo-filho). */
  removeGroupItem(briefingId: string, organizationId: string, groupItemId: string): Promise<void>;
}
