import { PrismaClient } from "./generated/client/index.js";

export * from "./generated/client/index.js";

declare global {
  var __milleadPrisma: PrismaClient | undefined;
}

/**
 * Instância única de PrismaClient para todo o monorepo. Reaproveitada via
 * `globalThis` em dev pra não abrir uma pool de conexões nova a cada
 * hot-reload do Next.js/tsx.
 */
export const prisma: PrismaClient =
  globalThis.__milleadPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__milleadPrisma = prisma;
}
