import type { ContractQueue } from "../../domain/services/contract-queue.js";
import { getBoss } from "./boss.js";
import { QUEUE_NAMES, type ContractJobData } from "./queues.js";

export class PgBossContractQueue implements ContractQueue {
  async enqueue(job: ContractJobData): Promise<void> {
    const boss = await getBoss();
    await boss.send(QUEUE_NAMES.CONTRACT_PROCESS, job, {
      retryLimit: 1, // 2 tentativas no total
      retryDelay: 5,
      retryBackoff: true,
    });
  }
}
