import type { Job } from "pg-boss";
import { logger } from "../../config/logger.js";
import { buildPostSaleOnboardingService } from "../../main/post-sale-factory.js";
import { getBoss } from "../../infrastructure/queue/boss.js";
import { QUEUE_NAMES, type PostSaleJobData } from "../../infrastructure/queue/queues.js";

/**
 * Worker da automação pós-fechamento. O trabalho pesado (lead, recebimentos,
 * briefing, projeto, tarefas) roda aqui, fora da requisição do webhook de
 * assinatura -- é o que garante que uma etapa lenta ou falha nunca segure a
 * confirmação da assinatura.
 *
 * O `run` é idempotente por construção (CAS de status + uniques de etapa e
 * artefato), então o retry do pg-boss é seguro: reexecuta só o que não
 * concluiu.
 */
const service = buildPostSaleOnboardingService();

void getBoss().then(async (boss) => {
  await boss.work<PostSaleJobData>(
    QUEUE_NAMES.POST_SALE_ONBOARDING,
    { batchSize: 1, pollingIntervalSeconds: 15 },
    async ([job]: Job<PostSaleJobData>[]) => {
      if (!job) return;
      const { executionId, contractId, organizationId } = job.data;
      logger.info({ jobId: job.id, executionId, contractId }, "processando pós-fechamento");
      try {
        const execution = await service.run(organizationId, executionId);
        logger.info(
          { jobId: job.id, executionId, status: execution.status },
          "pós-fechamento processado",
        );
      } catch (err) {
        logger.error({ jobId: job.id, executionId, contractId, err }, "pós-fechamento falhou");
        throw err;
      }
    },
  );
  logger.info("post-sale worker no ar, aguardando jobs...");
});
