import type { LandingPageQueue } from "../../domain/services/landing-page-queue.js";
import { getBoss } from "./boss.js";
import { QUEUE_NAMES, type LandingPageJobData } from "./queues.js";

export class PgBossLandingPageQueue implements LandingPageQueue {
  async enqueue(job: LandingPageJobData): Promise<void> {
    const boss = await getBoss();
    await boss.send(QUEUE_NAMES.LANDING_PAGE, job, {
      // Geração de IA é cara -- uma tentativa só; falha vira FAILED com
      // mensagem e o usuário reenfileira manualmente se quiser.
      retryLimit: 0,
    });
  }
}
