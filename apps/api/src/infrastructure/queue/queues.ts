/**
 * Nomes de fila e formatos de job centralizados aqui -- módulos futuros
 * adicionam constantes novas nesta lista em vez de strings soltas.
 * (A infra da fila é o pg-boss — ver boss.ts; este arquivo é só contrato.)
 */
export const QUEUE_NAMES = {
  AUDIT_SITE: "audit-site", // Fase 6 -- auditoria de site de prospect
  LANDING_PAGE: "landing-page", // Fase 8 -- geração de landing page por IA
  CONTRACT_PROCESS: "contract-process", // Fase 9 -- PDF + doc de assinatura
  BRIEFING_PROCESS: "briefing-process", // Fase 10 -- PDF + notificações de briefing
} as const;

export interface AuditJobData {
  auditId: string;
  organizationId: string;
  url: string;
}

export interface LandingPageJobData {
  landingPageId: string;
  organizationId: string;
}

export interface ContractJobData {
  contractId: string;
  organizationId: string;
}

export interface BriefingJobData {
  briefingId: string;
  organizationId: string;
}
