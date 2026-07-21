import { ContractProcessor } from "../../application/services/contract-processor.js";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { DefaultContractNotifier } from "../../infrastructure/contracts/notifications/contract-notifier.js";
import { renderContratoPDF } from "../../infrastructure/contracts/pdf/render.js";
import { createSignatureGateway } from "../../infrastructure/contracts/signature/factory.js";
import { PrismaContractRepository } from "../../infrastructure/prisma/prisma-contract-repository.js";
import type { Job } from "pg-boss";
import { getBoss } from "../../infrastructure/queue/boss.js";
import { QUEUE_NAMES, type ContractJobData } from "../../infrastructure/queue/queues.js";

/** Worker da fila de contratos (Fase 9): PDF -> assinatura -> convite. */
const processor = new ContractProcessor(
  new PrismaContractRepository(),
  (data) => renderContratoPDF(data),
  createSignatureGateway(),
  new DefaultContractNotifier(),
  `${env.APP_PUBLIC_URL}/api/v1/webhooks/signature`,
);

void getBoss().then(async (boss) => {
  await boss.work<ContractJobData>(
    QUEUE_NAMES.CONTRACT_PROCESS,
    { batchSize: 1, pollingIntervalSeconds: 15 },
    async ([job]: Job<ContractJobData>[]) => {
      if (!job) return;
      logger.info({ jobId: job.id, contractId: job.data.contractId }, "processando contrato");
      try {
        await processor.run(job.data.contractId, job.data.organizationId);
      } catch (err) {
        logger.error({ jobId: job.id, contractId: job.data.contractId, err }, "contrato falhou");
        throw err;
      }
      logger.info({ jobId: job.id, contractId: job.data.contractId }, "contrato processado");
    },
  );
  logger.info("contract worker no ar, aguardando jobs...");
});
