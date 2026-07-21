import { Worker } from "bullmq";
import { AuditRunner } from "../../application/services/audit-runner.js";
import { logger } from "../../config/logger.js";
import { HttpSiteAuditor } from "../../infrastructure/audit/http-site-auditor.js";
import { PrismaAuditRepository } from "../../infrastructure/prisma/prisma-audit-repository.js";
import { economyWorkerOptions, queueConnection } from "../../infrastructure/queue/connection.js";
import { QUEUE_NAMES, type AuditJobData } from "../../infrastructure/queue/queues.js";

/**
 * Worker da fila de auditoria de sites (Fase 6) -- processo separado do
 * servidor HTTP (`pnpm dev:worker` / `pnpm start:worker`), padrão do
 * ping.worker. Monta as próprias dependências: não importa o container do
 * servidor porque não precisa de controllers/middlewares.
 */
const runner = new AuditRunner(new PrismaAuditRepository(), new HttpSiteAuditor());

const worker = new Worker<AuditJobData>(
  QUEUE_NAMES.AUDIT_SITE,
  async (job) => {
    logger.info({ jobId: job.id, url: job.data.url }, "auditoria de site iniciada");
    await runner.run(job.data.auditId, job.data.url);
  },
  {
    connection: queueConnection,
    // Auditoria é I/O-bound (espera resposta do site) -- 3 em paralelo é
    // seguro e mantém o consumo de comandos Redis baixo (Upstash free).
    concurrency: 3,
    ...economyWorkerOptions,
  },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, auditId: job.data.auditId }, "auditoria concluída");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, auditId: job?.data.auditId, err }, "auditoria falhou");
});

// Erro de infra (conexão Redis etc.) sem listener derruba o processo — logar e seguir.
worker.on("error", (err) => {
  logger.error({ err }, "audit worker: erro de infra (segue vivo)");
});

logger.info("audit worker no ar, aguardando jobs...");
