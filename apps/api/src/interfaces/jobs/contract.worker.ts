import { Worker } from "bullmq";
import { ContractProcessor } from "../../application/services/contract-processor.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { DefaultContractNotifier } from "../../infrastructure/contracts/notifications/contract-notifier.js";
import { renderContratoPDF } from "../../infrastructure/contracts/pdf/render.js";
import { createSignatureGateway } from "../../infrastructure/contracts/signature/factory.js";
import { PrismaContractRepository } from "../../infrastructure/prisma/prisma-contract-repository.js";
import { queueConnection } from "../../infrastructure/queue/connection.js";
import { QUEUE_NAMES, type ContractJobData } from "../../infrastructure/queue/queues.js";

/** Worker da fila de contratos (Fase 9): PDF -> assinatura -> convite. */
const processor = new ContractProcessor(
  new PrismaContractRepository(),
  (data) => renderContratoPDF(data),
  createSignatureGateway(),
  new DefaultContractNotifier(),
  `${env.APP_PUBLIC_URL}/api/v1/webhooks/signature`,
);

const worker = new Worker<ContractJobData>(
  QUEUE_NAMES.CONTRACT_PROCESS,
  async (job) => {
    logger.info({ jobId: job.id, contractId: job.data.contractId }, "processando contrato");
    await processor.run(job.data.contractId, job.data.organizationId);
  },
  { connection: queueConnection, concurrency: 2 },
);

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, contractId: job.data.contractId }, "contrato processado");
});

worker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, contractId: job?.data.contractId, err }, "contrato falhou");
});

logger.info("contract worker no ar, aguardando jobs...");
