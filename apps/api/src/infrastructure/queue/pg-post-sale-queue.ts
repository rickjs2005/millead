import type { PostSaleJobData, PostSaleQueue } from "../../domain/services/post-sale-queue.js";
import { getBoss } from "./boss.js";
import { QUEUE_NAMES } from "./queues.js";

export class PgBossPostSaleQueue implements PostSaleQueue {
  async enqueue(job: PostSaleJobData): Promise<void> {
    const boss = await getBoss();
    await boss.send(QUEUE_NAMES.POST_SALE_ONBOARDING, job, {
      retryLimit: 2, // 3 tentativas no total -- cada etapa é idempotente
      retryDelay: 10,
      retryBackoff: true,
      // Enquanto um job desta execução estiver na fila ou rodando, o pg-boss
      // descarta duplicatas. É só a PRIMEIRA camada: a garantia de verdade é
      // o CAS de status + os uniques de etapa/artefato no banco.
      singletonKey: job.executionId,
    });
  }
}
