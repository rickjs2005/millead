import { PgBoss } from "pg-boss";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { QUEUE_NAMES } from "./queues.js";

/**
 * Fila no PRÓPRIO Postgres (pg-boss) — substituiu BullMQ+Redis em 21/07/2026,
 * depois que a cota do Upstash free estourou ("ERR max requests limit
 * exceeded") e derrubou a API em produção por 23h. Uma dependência externa a
 * menos: o Supabase que já guarda os dados carrega também a fila (schema
 * "pgboss", criado automaticamente no primeiro start). O volume do CRM
 * (dezenas de jobs/dia) não faz cócegas no banco — e Postgres não tem cota
 * de comandos pra estourar.
 */
let instance: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

export function getBoss(): Promise<PgBoss> {
  if (!starting) {
    const boss = new PgBoss({
      connectionString: env.DATABASE_URL,
      schema: "pgboss",
      // Pool pequeno de propósito: a fila divide o Postgres com a aplicação.
      max: 3,
    });
    // Sem listener, um erro de infra vira 'error' não tratado e derruba o
    // processo — exatamente o bug que deixou o CRM fora do ar com o Redis.
    boss.on("error", (err: Error) => logger.error({ err }, "pg-boss: erro de infra (segue vivo)"));
    starting = boss.start().then(async (b: PgBoss) => {
      // O pg-boss exige a fila criada antes de send/work. try/catch por via
      // das dúvidas: fila já existente não pode impedir o boot.
      for (const name of Object.values(QUEUE_NAMES)) {
        try {
          await b.createQueue(name);
        } catch (err) {
          logger.warn({ err, queue: name }, "createQueue falhou (provavelmente já existe)");
        }
      }
      instance = b;
      logger.info("pg-boss no ar (fila no Postgres, schema pgboss)");
      return b;
    });
  }
  return starting!;
}

export async function stopBoss(): Promise<void> {
  if (instance) await instance.stop({ graceful: false });
}
