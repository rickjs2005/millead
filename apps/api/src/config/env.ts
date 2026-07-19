import { z } from "zod";

/**
 * Valor exato do placeholder que vai no `.env.example` -- é público (está no
 * repositório), então qualquer deploy que o herde tem um segredo HMAC
 * conhecido e qualquer um consegue forjar access tokens. Rejeitado em
 * produção pelo `superRefine` abaixo.
 */
const PLACEHOLDER_JWT_SECRET = "troque-este-segredo-por-um-de-verdade-com-32-chars-ou-mais";

/**
 * Falha rápido na inicialização se faltar/estiver inválida uma env var --
 * melhor um crash claro no boot do que um 500 misterioso em produção.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  /**
   * Nº de proxies confiáveis à frente da API (Render = 1). Vira o valor de
   * `app.set("trust proxy", …)`. NÃO usar `true`/valor alto: com trust total
   * o Express confia no X-Forwarded-For que o CLIENTE manda, e o rate-limit
   * (que usa req.ip como chave) pode ser burlado trocando esse header.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  // 32+ chars (256 bits) é o mínimo razoável pra um segredo HMAC (HS256) --
  // refresh tokens não usam JWT/segredo nenhum (são opacos, ver
  // infrastructure/auth/refresh-token-generator.ts), só o access token.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  /** true = workers BullMQ no mesmo processo da API (deploy de 1 serviço só). */
  START_WORKERS: z.coerce.boolean().default(false),
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
  // Atualmente NÃO usado: os planos básicos do ZapSign não assinam o webhook
  // nem permitem header customizado, então a autenticidade vem da reconsulta na
  // API do ZapSign (confirmarAssinado) + rate-limit na rota. Mantido pra caso
  // um plano futuro permita header. Pode remover do Render sem impacto.
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

  // ===== Briefings (Fase 10) =====
  // Sem fallback no-op de propósito: diferente de SMTP/WhatsApp (onde "não
  // notificar" é aceitável), sem storage o upload de arquivo simplesmente
  // não existe -- falha rápido no boot em vez de 500 tardio no primeiro upload.
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  // URL pública do APP Next (não da API -- ver APP_PUBLIC_URL acima) usada
  // pra montar o link /b/:token em e-mail e WhatsApp.
  WEB_PUBLIC_URL: z.string().default("http://localhost:3000"),
});

/**
 * Endurecimentos que só valem em produção -- em dev/test o placeholder e o
 * default de CORS são convenientes; em produção são falhas de segurança.
 */
const productionEnvSchema = envSchema.superRefine((val, ctx) => {
  if (val.NODE_ENV !== "production") return;

  if (val.JWT_ACCESS_SECRET === PLACEHOLDER_JWT_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["JWT_ACCESS_SECRET"],
      message:
        "JWT_ACCESS_SECRET está com o valor placeholder do .env.example (público no repositório). " +
        "Gere um segredo único: `openssl rand -base64 48`.",
    });
  }

  // Sem CORS_ORIGIN explícita, o default `localhost:3000` ficaria na
  // allowlist com credentials em produção.
  if (val.CORS_ORIGIN === "http://localhost:3000") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CORS_ORIGIN"],
      message: "CORS_ORIGIN deve ser definida explicitamente em produção (não pode ser o default localhost).",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = productionEnvSchema.parse(process.env);
