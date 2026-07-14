import { prisma } from "@millead/database";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { redis } from "../infrastructure/redis/redis-client.js";
import { buildContainer } from "./container.js";
import { createApp } from "./app.js";

const container = buildContainer();
const app = createApp(container);

const server = app.listen(env.API_PORT, () => {
  logger.info(`MilLead API no ar em http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} recebido, encerrando com calma...`);
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
    logger.info("desligado.");
    process.exit(0);
  });
  // Se algo travar, força a saída em vez de pendurar o processo pra sempre.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
