import type { BriefingQueue } from "../../domain/services/briefing-queue.js";
import { getBoss } from "./boss.js";
import { QUEUE_NAMES, type BriefingJobData } from "./queues.js";

export class PgBossBriefingQueue implements BriefingQueue {
  async enqueue(job: BriefingJobData): Promise<void> {
    const boss = await getBoss();
    await boss.send(QUEUE_NAMES.BRIEFING_PROCESS, job, {
      retryLimit: 1, // 2 tentativas no total
      retryDelay: 5,
      retryBackoff: true,
    });
  }
}
