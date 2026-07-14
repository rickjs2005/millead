import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";

/**
 * Nomes de fila centralizados aqui -- módulos futuros (Fase 6 auditoria,
 * Fase 7 mensagens IA) adicionam constantes novas nesta lista em vez de
 * strings soltas espalhadas pelo código.
 */
export const QUEUE_NAMES = {
  PING: "ping", // fila de exemplo, só pra provar que a infra funciona
  AUDIT_SITE: "audit-site", // Fase 6 -- auditoria de site de prospect
  LANDING_PAGE: "landing-page", // Fase 8 -- geração de landing page por IA
  CONTRACT_PROCESS: "contract-process", // Fase 9 -- PDF + doc de assinatura
} as const;

export interface PingJobData {
  message: string;
  requestedAt: string;
}

export const pingQueue = new Queue<PingJobData>(QUEUE_NAMES.PING, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

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
