import { z } from "zod";
import { boolEnv } from "./bool-env.js";

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
  // 32+ chars (256 bits) é o mínimo razoável pra um segredo HMAC (HS256) --
  // refresh tokens não usam JWT/segredo nenhum (são opacos, ver
  // infrastructure/auth/refresh-token-generator.ts), só o access token.
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("30d"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  /** true = workers BullMQ no mesmo processo da API (deploy de 1 serviço só). */
  START_WORKERS: boolEnv(false),
  /**
   * Registro público de conta/organização. Default true (não quebra nada);
   * em produção fica FALSE (sistema interno da MilWeb) — flip temporário
   * quando precisar cadastrar alguém novo da equipe.
   */
  REGISTRATION_OPEN: boolEnv(true),
  // ===== IA (Fase 7) =====
  // Opcional de propósito: sem chave nenhuma, o app sobe normalmente e os
  // endpoints de IA respondem 503 com instrução de configuração.
  // Dois provedores: a API gratuita da NVIDIA (Nemotron, formato OpenAI) e a
  // Anthropic (Claude). Sem AI_PROVIDER, a chave presente decide -- e a
  // NVIDIA ganha o desempate por ser gratuita (ver chat-model-factory.ts).
  AI_PROVIDER: z.enum(["anthropic", "nvidia"]).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().default("claude-opus-5"),
  NVIDIA_API_KEY: z.string().min(1).optional(),
  NVIDIA_MODEL: z.string().default("nvidia/nemotron-3.5-lightning-30b-a3b"),
  // Qualquer servidor no formato OpenAI serve aqui (OpenRouter, vLLM local…).
  NVIDIA_BASE_URL: z.string().url().default("https://integrate.api.nvidia.com/v1"),

  // ===== MilSocial (ferramenta interna do dono) =====
  // Opcionais: sem eles as rotas /admin/social respondem 503.
  // INSTAGRAM_ACCESS_TOKEN é o seed inicial do token long-lived; apos o
  // primeiro refresh, a linha de SocialConfig no banco vira a fonte de verdade.
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  // Chave do cron do GitHub Actions pro sync diario sem sessao de usuario.
  // Precisa ser IDENTICA ao secret MILSOCIAL_SYNC_KEY do repositorio -- se
  // divergirem (ou faltar de um lado), o sync diario responde 401 em silencio.
  MILSOCIAL_SYNC_KEY: z.string().min(24).optional(),

  // ===== Contratos (Fase 9 -- migrado do milweb-contratos) =====
  // URL pública da API (webhooks de assinatura apontam pra cá).
  APP_PUBLIC_URL: z.string().default("http://localhost:4000"),
  SIGNATURE_PROVIDER: z.enum(["mock", "zapsign"]).default("mock"),
  // O token é POR AMBIENTE: com ZAPSIGN_SANDBOX=true tem que ser o token da
  // conta de testes (sandbox.app.zapsign.com.br), não o de produção.
  ZAPSIGN_API_TOKEN: z.string().optional(),
  // Atualmente NÃO usado: os planos básicos do ZapSign não assinam o webhook
  // nem permitem header customizado, então a autenticidade vem da reconsulta na
  // API do ZapSign (confirmarAssinado) + rate-limit na rota. Mantido pra caso
  // um plano futuro permita header. Pode remover do Render sem impacto.
  ZAPSIGN_WEBHOOK_SECRET: z.string().optional(),
  // true = fala com sandbox.api.zapsign.com.br: sem validade jurídica e sem
  // exigir Plano de API (só o ambiente de produção exige). Precisa vir com o
  // token da conta de sandbox em ZAPSIGN_API_TOKEN.
  ZAPSIGN_SANDBOX: boolEnv(false),
  ZAPSIGN_SEND_WHATSAPP: boolEnv(false),
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
  // ===== Automação de checklist de projetos (Claude Code, sem sessão) =====
  // Chave usada pelas skills site-institucional/sistema-web pra sincronizar
  // project-state.md com o MilLead sem login. Opcional: sem ela, as rotas
  // /api/v1/project-checklists continuam funcionando normalmente por sessão
  // de usuário -- só a sincronização automática fica desativada.
  AUTOMATION_API_KEY: z.string().min(24).optional(),
  AUTOMATION_ORGANIZATION_ID: z.string().optional(),
  // ===== Web Push (PWA) — opcional; sem as chaves a feature fica muda =====
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:contato@milweb.com.br"),
  // WhatsApp próprio (Meta Cloud API -- opcional)
  WHATSAPP_ENABLED: boolEnv(false),
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

  // ===== Cofre Financeiro (finanças pessoais do dono da conta) =====
  // Segredo PRÓPRIO da sessão elevada, separado do JWT_ACCESS_SECRET de
  // propósito: com o mesmo segredo, quem forjasse (ou vazasse) um access
  // token estaria a um campo de distância de forjar também a sessão do
  // Cofre. Segredos distintos = comprometer um não entrega o outro.
  //
  // Opcional, e a ausência FECHA o módulo (todas as rotas do Cofre passam a
  // responder 404) em vez de abri-lo sem sessão elevada. É o inverso do
  // padrão dos outros opcionais (IA/SMTP viram no-op): aqui degradar
  // significaria servir dado financeiro sem a segunda barreira.
  VAULT_SESSION_SECRET: z.string().min(32).optional(),
  // Inatividade tolerada. A sessão renova a cada request autorizada, então
  // este é o tempo PARADO até o Cofre se fechar sozinho.
  VAULT_SESSION_TTL: z.string().default("15m"),
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

  // Reusar o segredo do access token na sessão elevada anularia o ganho de
  // ter duas barreiras: um vazamento entregaria as duas de uma vez.
  if (val.VAULT_SESSION_SECRET && val.VAULT_SESSION_SECRET === val.JWT_ACCESS_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["VAULT_SESSION_SECRET"],
      message:
        "VAULT_SESSION_SECRET não pode ser igual a JWT_ACCESS_SECRET -- a sessão do Cofre " +
        "existe justamente pra ser uma barreira independente. Gere outro: `openssl rand -base64 48`.",
    });
  }

  // Sem CORS_ORIGIN explícita, o default `localhost:3000` ficaria na
  // allowlist com credentials em produção.
  if (val.CORS_ORIGIN === "http://localhost:3000") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CORS_ORIGIN"],
      message:
        "CORS_ORIGIN deve ser definida explicitamente em produção (não pode ser o default localhost).",
    });
  }
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = productionEnvSchema.parse(process.env);
