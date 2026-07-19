import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redis } from "../../../infrastructure/redis/redis-client.js";

/**
 * Store compartilhado no Redis (Upstash) pros limiters. O MemoryStore default
 * do express-rate-limit zera a cada restart/deploy e NÃO é compartilhado entre
 * instâncias/processos -- com >1 instância (ou autoscaling) o limite viraria
 * N× maior e inconsistente. Reusa a conexão ioredis de uso geral do app.
 *
 * Cada limiter recebe um `prefix` próprio pra não misturar baldes (o de auth
 * conta por IP; o de IA, por usuário). Tradeoff: se o Redis cair, os limiters
 * passam a rejeitar (o app já depende de Redis pra health check e BullMQ, mas
 * vale monitorar).
 */
function redisStore(prefix: string): RedisStore {
  return new RedisStore({
    prefix,
    // ioredis: `call(cmd, ...args)`. O retorno é `unknown`; o store espera
    // `RedisReply` (primitivo ou array de primitivos) -- cast seguro só em tipo.
    sendCommand: (...args: string[]) =>
      redis.call(args[0]!, ...args.slice(1)) as Promise<number | string | Array<number | string>>,
  });
}

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
  store: redisStore("rl:auth:"),
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
  store: redisStore("rl:public:"),
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
  store: redisStore("rl:ai:"),
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas requisições de IA. Tente novamente em alguns minutos.",
    },
  },
});
