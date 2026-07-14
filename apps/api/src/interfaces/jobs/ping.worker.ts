import { Worker } from "bullmq";
import { logger } from "../../config/logger.js";
import { queueConnection } from "../../infrastructure/queue/connection.js";
import { QUEUE_NAMES, type PingJobData } from "../../infrastructure/queue/queues.js";

/**
 * Worker de exemplo -- roda como PROCESSO SEPARADO do servidor HTTP
 * (`pnpm dev:worker` / `pnpm start:worker`), prática padrão do BullMQ pra
 * não competir por CPU/memória com quem serve requisições. Fica dormente
 * até o primeiro job real de negócio (Fase 6/7) assumir esse padrão.
 */
const worker = new Worker<PingJobData>(
  QUEUE_NAMES.PING,
  async (job) => {
    logger.info({ jobId: job.id, data: job.data }, "ping job recebido");
    return { pong: true, receivedMessage: job.data.message };
  },
  { connection: queueConnection },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "ping job concluído");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "ping job falhou");
});

logger.info("ping worker no ar, aguardando jobs...");
