import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

/**
 * Nomes de fila centralizados aqui -- módulos futuros (Fase 6 auditoria,
 * Fase 7 mensagens IA) adicionam constantes novas nesta lista em vez de
 * strings soltas espalhadas pelo código.
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

export const contractQueue = new Queue<ContractJobData>(QUEUE_NAMES.CONTRACT_PROCESS, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

export const landingPageQueue = new Queue<LandingPageJobData>(QUEUE_NAMES.LANDING_PAGE, {
  connection: queueConnection,
  defaultJobOptions: {
    // Geração de IA é cara -- uma tentativa só; falha vira FAILED com
    // mensagem e o usuário reenfileira manualmente se quiser.
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const auditQueue = new Queue<AuditJobData>(QUEUE_NAMES.AUDIT_SITE, {
  connection: queueConnection,
  defaultJobOptions: {
    // 2 tentativas: a segunda cobre soluço de rede; mais que isso só atrasa
    // o FAILED que a UI está esperando (o runner é idempotente no retry).
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});

export interface BriefingJobData {
  briefingId: string;
  organizationId: string;
}

export const briefingQueue = new Queue<BriefingJobData>(QUEUE_NAMES.BRIEFING_PROCESS, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 500,
  },
});
