import { AuditRunner } from "../../application/services/audit-runner.js";
import { logger } from "../../config/logger.js";
import { HttpSiteAuditor } from "../../infrastructure/audit/http-site-auditor.js";
import { PrismaAuditRepository } from "../../infrastructure/prisma/prisma-audit-repository.js";
import type { Job } from "pg-boss";
import { getBoss } from "../../infrastructure/queue/boss.js";
import { QUEUE_NAMES, type AuditJobData } from "../../infrastructure/queue/queues.js";

/**
 * Worker da fila de auditoria de sites (Fase 6), agora em pg-boss (fila no
 * Postgres). Monta as próprias dependências: não importa o container do
 * servidor porque não precisa de controllers/middlewares.
 */
const runner = new AuditRunner(new PrismaAuditRepository(), new HttpSiteAuditor());

void getBoss().then(async (boss) => {
  await boss.work<AuditJobData>(
    QUEUE_NAMES.AUDIT_SITE,
    // Polling de 15s: auditoria é disparada por gente olhando a tela.
    // (No pg-boss o polling custa 1 query no Postgres — sem cota pra estourar.)
    { batchSize: 1, pollingIntervalSeconds: 15 },
    async ([job]: Job<AuditJobData>[]) => {
      if (!job) return;
      logger.info({ jobId: job.id, url: job.data.url }, "auditoria de site iniciada");
      try {
        await runner.run(job.data.auditId, job.data.url);
      } catch (err) {
        logger.error({ jobId: job.id, auditId: job.data.auditId, err }, "auditoria falhou");
        throw err;
      }
      logger.info({ jobId: job.id, auditId: job.data.auditId }, "auditoria concluída");
    },
  );
  logger.info("audit worker no ar, aguardando jobs...");
});
