import { LandingPageRunner } from "../../application/services/landing-page-runner.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { ClaudeLandingPageGenerator } from "../../infrastructure/ai/claude-landing-page-generator.js";
import { PrismaAuditRepository } from "../../infrastructure/prisma/prisma-audit-repository.js";
import { PrismaCompanyRepository } from "../../infrastructure/prisma/prisma-company-repository.js";
import { PrismaLandingPageRepository } from "../../infrastructure/prisma/prisma-landing-page-repository.js";
import { PrismaOrganizationRepository } from "../../infrastructure/prisma/prisma-organization-repository.js";
import type { Job } from "pg-boss";
import { getBoss } from "../../infrastructure/queue/boss.js";
import { QUEUE_NAMES, type LandingPageJobData } from "../../infrastructure/queue/queues.js";

/**
 * Worker da fila de landing pages (Fase 8). Gerar uma página pode levar 1-2
 * minutos (HTML grande via IA), por isso NUNCA roda no request HTTP.
 * batchSize 1 = uma geração por vez (rate limit da Anthropic).
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

void getBoss().then(async (boss) => {
  await boss.work<LandingPageJobData>(
    QUEUE_NAMES.LANDING_PAGE,
    { batchSize: 1, pollingIntervalSeconds: 15 },
    async ([job]: Job<LandingPageJobData>[]) => {
      if (!job) return;
      logger.info({ jobId: job.id, landingPageId: job.data.landingPageId }, "geração iniciada");
      try {
        await runner.run(job.data.landingPageId, job.data.organizationId);
      } catch (err) {
        logger.error(
          { jobId: job.id, landingPageId: job.data.landingPageId, err },
          "geração de landing page falhou",
        );
        throw err;
      }
      logger.info({ jobId: job.id, landingPageId: job.data.landingPageId }, "landing page pronta");
    },
  );
  logger.info("landing page worker no ar, aguardando jobs...");
});
