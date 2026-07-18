import { Worker } from "bullmq";
import { BriefingProcessor } from "../../application/services/briefing-processor.js";
import { logger } from "../../config/logger.js";
import { VercelBlobStorage } from "../../infrastructure/blob/vercel-blob-storage.js";
import { DefaultBriefingNotifier } from "../../infrastructure/briefings/notifications/briefing-notifier.js";
import { renderBriefingPDF } from "../../infrastructure/briefings/pdf/render.js";
import { PrismaBriefingRepository } from "../../infrastructure/prisma/prisma-briefing-repository.js";
import { queueConnection } from "../../infrastructure/queue/connection.js";
import { QUEUE_NAMES, type BriefingJobData } from "../../infrastructure/queue/queues.js";

/** Worker da fila de briefings (Fase 10): PDF -> Blob -> e-mail -> WhatsApp. */
const processor = new BriefingProcessor(
  new PrismaBriefingRepository(),
  (data) => renderBriefingPDF(data),
  new VercelBlobStorage(),
  new DefaultBriefingNotifier(),
);

const worker = new Worker<BriefingJobData>(
  QUEUE_NAMES.BRIEFING_PROCESS,
  async (job) => {
    logger.info({ jobId: job.id, briefingId: job.data.briefingId }, "processando briefing");
    await processor.run(job.data.briefingId, job.data.organizationId);
  },
  { connection: queueConnection, concurrency: 2 },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, briefingId: job.data.briefingId }, "briefing processado");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, briefingId: job?.data.briefingId, err }, "briefing falhou");
});

logger.info("briefing worker no ar, aguardando jobs...");
