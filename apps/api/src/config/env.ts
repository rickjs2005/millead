import { z } from "zod";

/**
 * Falha rápido na inicialização se faltar/estiver inválida uma env var --
 * melhor um crash claro no boot do que um 500 misterioso em produção.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  // 32+ chars (256 bits) é o mínimo razoável pra um segredo HMAC (HS256) --
  // refresh tokens não usam JWT/segredo nenhum (são opacos, ver
  // infrastructure/auth/refresh-token-generator.ts), só o access token.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  // ===== IA (Fase 7) =====
  // Opcional de propósito: sem a chave, o app sobe normalmente e os
  // endpoints de IA respondem 503 com instrução de configuração.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().default("claude-opus-4-8"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
