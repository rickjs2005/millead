import { Worker } from "bullmq";
import { LandingPageRunner } from "../../application/services/landing-page-runner.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { ClaudeLandingPageGenerator } from "../../infrastructure/ai/claude-landing-page-generator.js";
import { PrismaAuditRepository } from "../../infrastructure/prisma/prisma-audit-repository.js";
import { PrismaCompanyRepository } from "../../infrastructure/prisma/prisma-company-repository.js";
import { PrismaLandingPageRepository } from "../../infrastructure/prisma/prisma-landing-page-repository.js";
import { PrismaOrganizationRepository } from "../../infrastructure/prisma/prisma-organization-repository.js";
import { economyWorkerOptions, queueConnection } from "../../infrastructure/queue/connection.js";
import { QUEUE_NAMES, type LandingPageJobData } from "../../infrastructure/queue/queues.js";

/**
 * Worker da fila de landing pages (Fase 8) -- processo separado do servidor
 * HTTP, padrão dos demais workers. Gerar uma página pode levar 1-2 minutos
 * (HTML grande via IA), por isso NUNCA roda no request HTTP.
 */
const runner = new LandingPageRunner(
  new PrismaLandingPageRepository(),
  new PrismaCompanyRepository(),
  new PrismaAuditRepository(),
  new PrismaOrganizationRepository(),
  env.ANTHROPIC_API_KEY
    ? new ClaudeLandingPageGenerator(env.ANTHROPIC_API_KEY, env.AI_MODEL)
    : null,
);

const worker = new Worker<LandingPageJobData>(
  QUEUE_NAMES.LANDING_PAGE,
  async (job) => {
    logger.info({ jobId: job.id, landingPageId: job.data.landingPageId }, "geração iniciada");
    await runner.run(job.data.landingPageId, job.data.organizationId);
  },
  {
    connection: queueConnection,
    // Geração é cara (tokens) e demorada -- uma por vez evita estourar
    // rate limit da API da Anthropic e o plano free do Upstash.
    concurrency: 1,
    ...economyWorkerOptions,
  },
);

// Erro de infra (conexão Redis etc.) sem listener derruba o processo — logar e seguir.
worker.on("error", (err) => {
  logger.error({ err }, "landing page worker: erro de infra (segue vivo)");
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, landingPageId: job.data.landingPageId }, "landing page pronta");
});

worker.on("failed", (job, err) => {
  logger.error(
    { jobId: job?.id, landingPageId: job?.data.landingPageId, err },
    "geração de landing page falhou",
  );
});

logger.info("landing page worker no ar, aguardando jobs...");
