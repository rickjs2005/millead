/**
 * Nomes de fila e formatos de job centralizados aqui -- módulos futuros
 * adicionam constantes novas nesta lista em vez de strings soltas.
 * (A infra da fila é o pg-boss — ver boss.ts; este arquivo é só contrato.)
 */
export const QUEUE_NAMES = {
  AUDIT_SITE: "audit-site", // Fase 6 -- auditoria de site de prospect
  CONTRACT_PROCESS: "contract-process", // Fase 9 -- PDF + doc de assinatura
  BRIEFING_PROCESS: "briefing-process", // Fase 10 -- PDF + notificações de briefing
  POST_SALE_ONBOARDING: "post-sale-onboarding", // Automação pós-fechamento (contrato assinado)
} as const;

export interface AuditJobData {
  auditId: string;
  organizationId: string;
  url: string;
}

export interface ContractJobData {
  contractId: string;
  organizationId: string;
}

export interface BriefingJobData {
  briefingId: string;
  organizationId: string;
}

/** Formato do job da automação pós-fechamento -- espelha `PostSaleJobData`
 *  (domain/services/post-sale-queue.ts), que é a porta que a aplicação usa. */
export interface PostSaleJobData {
  executionId: string;
  contractId: string;
  organizationId: string;
}
