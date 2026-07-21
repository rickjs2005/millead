import { Redis } from "ioredis";
import type { WorkerOptions } from "bullmq";
import { env } from "../../config/env.js";

/** BullMQ exige `maxRetriesPerRequest: null` -- conexão dedicada, separada da genérica. */
export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Sem este handler, um erro de conexão vira evento 'error' sem listener e
// DERRUBA a API inteira (uncaught) — aconteceu em produção em 21/07/2026:
// cota do Upstash free estourada ("ERR max requests limit exceeded") →
// crash-loop no Render com o CRM fora do ar. Fila indisponível não pode
// matar o HTTP: jobs falham e ficam pra retry, a API continua servindo.
queueConnection.on("error", (err) => {
  console.error("[queue-redis] connection error:", err.message);
});

/**
 * Opções compartilhadas dos workers, calibradas pro Upstash free (500K
 * comandos/mês): com os defaults do BullMQ (drainDelay 5s + stalledInterval
 * 30s), CADA worker ocioso queima ~20K comandos/dia — 5 workers 24h/dia
 * esgotaram a cota do mês em dias. Com 120s/5min cai pra ~1K/dia por
 * worker. Jobs novos NÃO esperam o drainDelay: o comando bloqueante acorda
 * na hora em que a fila recebe algo; só a varredura de job TRAVADO (crash
 * no meio do processamento) fica mais espaçada — aceitável pro volume
 * deste CRM (poucas dezenas de jobs/dia).
 */
export const economyWorkerOptions = {
  drainDelay: 120, // segundos de long-poll com a fila vazia (default: 5)
  stalledInterval: 300_000, // ms entre varreduras de job travado (default: 30s)
} satisfies Partial<WorkerOptions>;
