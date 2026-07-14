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

  // ===== Contratos (Fase 9 -- migrado do milweb-contratos) =====
  // URL pública da API (webhooks de assinatura apontam pra cá).
  APP_PUBLIC_URL: z.string().default("http://localhost:4000"),
  SIGNATURE_PROVIDER: z.enum(["mock", "zapsign"]).default("mock"),
  ZAPSIGN_API_TOKEN: z.string().optional(),
  ZAPSIGN_WEBHOOK_SECRET: z.string().optional(),
  ZAPSIGN_SANDBOX: z.coerce.boolean().default(false),
  ZAPSIGN_SEND_WHATSAPP: z.coerce.boolean().default(false),
  // Dados da contratada nos contratos (snapshot jurídico). Sem eles, usa o
  // nome da organização e campos em branco -- preencha antes de uso real.
  CONTRACTOR_RAZAO_SOCIAL: z.string().optional(),
  CONTRACTOR_CNPJ: z.string().optional(),
  CONTRACTOR_DOC_LABEL: z.string().default("CNPJ"),
  CONTRACTOR_ENDERECO: z.string().optional(),
  CONTRACTOR_EMAIL: z.string().optional(),
  CONTRACTOR_FORO: z.string().optional(),
  // E-mail (opcional -- sem SMTP_HOST, envio vira no-op logado)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  OWNER_EMAIL: z.string().optional(),
  // WhatsApp próprio (Meta Cloud API -- opcional)
  WHATSAPP_ENABLED: z.coerce.boolean().default(false),
  WHATSAPP_PHONE_ID: z.string().optional(),
  WHATSAPP_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default("v21.0"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
