import type { Request } from "express";
import rateLimit from "express-rate-limit";

/**
 * Limiters no MemoryStore default do express-rate-limit. O store Redis foi
 * REMOVIDO em 21/07/2026 junto com o resto do Redis (incidente da cota do
 * Upstash — e com o Redis fora, os limiters rejeitavam TUDO, login incluso).
 * Tradeoff conhecido: o balde zera a cada restart/deploy e não é
 * compartilhado entre instâncias — irrelevante hoje (1 instância no Render
 * free). Se um dia houver múltiplas instâncias/autoscaling, reintroduzir um
 * store compartilhado (ex.: rate-limit-postgres na mesma base do pg-boss).
 */

/**
 * Chave por usuário autenticado (cai pro IP se, por algum motivo, `req.auth`
 * não existir -- não deveria, já que o limiter roda depois do `authenticate`).
 * Usado no limiter de IA: o custo é por conta da organização, então limitar
 * por IP deixaria vários usuários da mesma org compartilharem um único balde,
 * ou um só usuário atrás de NAT ser punido pelos colegas.
 */
function authUserKey(req: Request): string {
  return req.auth?.userId ?? req.ip ?? "unknown";
}

/**
 * Limite pras rotas mais visadas por força-bruta/enumeração de e-mail
 * (login, registro, refresh). Por IP -- não é perfeito (NAT/proxy
 * compartilham IP), mas é a defesa mínima antes de existir qualquer outra
 * (CAPTCHA, lockout por conta, WAF). Ajustar o `max` se o volume real de
 * uso legítimo (ex.: um app mobile que dá refresh a cada poucos minutos)
 * esbarrar nisso.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Tente novamente mais tarde." },
  },
});

/**
 * Limite pras rotas públicas sem login (fechamento de contrato, wizard de
 * briefing, landing pages). Mais permissivo que o de auth: o autosave do
 * briefing dispara várias vezes numa sessão legítima de preenchimento.
 */
export const publicRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas requisições. Tente novamente em alguns minutos.",
    },
  },
});

/**
 * Limite pras rotas que chamam a Anthropic (score/report/message de lead e
 * regeneração de landing page -- esta última usa até 48k tokens por chamada).
 * Sem isso, qualquer usuário autenticado com LEADS_READ pode fazer loop e
 * queimar a conta da Anthropic. Chave por usuário (ver authUserKey), não por
 * IP. Ajustar `max` conforme o uso real; considerar também cota diária por
 * organização persistida quando houver volume.
 */
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authUserKey,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas requisições de IA. Tente novamente em alguns minutos.",
    },
  },
});
