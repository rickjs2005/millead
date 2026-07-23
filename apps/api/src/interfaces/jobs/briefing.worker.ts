import { BriefingProcessor } from "../../application/services/briefing-processor.js";
import { logger } from "../../config/logger.js";
import { VercelBlobStorage } from "../../infrastructure/blob/vercel-blob-storage.js";
import { DefaultBriefingNotifier } from "../../infrastructure/briefings/notifications/briefing-notifier.js";
import { renderBriefingPDF } from "../../infrastructure/briefings/pdf/render.js";
import { CachedBriefingTemplateRepository } from "../../infrastructure/prisma/cached-briefing-template-repository.js";
import { PrismaBriefingRepository } from "../../infrastructure/prisma/prisma-briefing-repository.js";
import { PrismaBriefingTemplateRepository } from "../../infrastructure/prisma/prisma-briefing-template-repository.js";
import type { Job } from "pg-boss";
import { getBoss } from "../../infrastructure/queue/boss.js";
import { QUEUE_NAMES, type BriefingJobData } from "../../infrastructure/queue/queues.js";

/** Worker da fila de briefings (Fase 10): PDF -> Blob -> e-mail -> WhatsApp. */
const processor = new BriefingProcessor(
  new PrismaBriefingRepository(
    new CachedBriefingTemplateRepository(new PrismaBriefingTemplateRepository()),
  ),
  (data) => renderBriefingPDF(data),
  new VercelBlobStorage(),
  new DefaultBriefingNotifier(),
);

void getBoss().then(async (boss) => {
  await boss.work<BriefingJobData>(
    QUEUE_NAMES.BRIEFING_PROCESS,
    // 15s: o cliente acabou de finalizar o wizard; o PDF/e-mail deve sair logo.
    { batchSize: 1, pollingIntervalSeconds: 15 },
    async ([job]: Job<BriefingJobData>[]) => {
      if (!job) return;
      logger.info({ jobId: job.id, briefingId: job.data.briefingId }, "processando briefing");
      try {
        await processor.run(job.data.briefingId, job.data.organizationId);
      } catch (err) {
        logger.error({ jobId: job.id, briefingId: job.data.briefingId, err }, "briefing falhou");
        throw err;
      }
      logger.info({ jobId: job.id, briefingId: job.data.briefingId }, "briefing processado");
    },
  );
  logger.info("briefing worker no ar, aguardando jobs...");
});
