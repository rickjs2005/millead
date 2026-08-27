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
 * briefing). Mais permissivo que o de auth: o autosave do briefing dispara
 * várias vezes numa sessão legítima de preenchimento.
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
 * direção criativa -- esta última usa até 32k tokens por chamada).
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

/**
 * Desbloqueio do Cofre. Chave por USUÁRIO (não por IP): o dono é um só, e
 * limitar por IP puniria ele por trocar de rede enquanto deixaria um
 * atacante distribuído girar o balde à vontade.
 *
 * É a segunda trava, não a principal -- o lockout escalonado gravado em
 * `personal_vaults` é quem realmente segura o ataque, porque sobrevive ao
 * restart do processo (o MemoryStore daqui não sobrevive, e no Render free o
 * processo dorme). Esta existe pra cortar volume antes de chegar ao bcrypt,
 * inclusive de contas que não têm Cofre e portanto não têm contador.
 */
export const vaultUnlockRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authUserKey,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas. Tente novamente mais tarde.",
    },
  },
});

/**
 * Exportação: limita o volume, não a pessoa.
 *
 * Vinte por hora, e não cinco: o número existe pra impedir que um script drene
 * o Cofre em rajada, não pra racionar backup. Quem exporta de verdade faz
 * JSON, depois CSV, às vezes erra a senha e repete — cinco acabam antes de a
 * pessoa terminar o que veio fazer, e um limite que atrapalha o uso legítimo é
 * um limite que vai ser contornado.
 *
 * A defesa contra adivinhar senha aqui **não é este contador**: é o balde de
 * tentativas compartilhado com o desbloqueio, que bloqueia o Cofre inteiro
 * (ver `VaultReauthenticator`).
 */
export const vaultExportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authUserKey,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas exportações seguidas. Tente novamente daqui a pouco.",
    },
  },
});

/**
 * Restauração: contador **separado** do de exportação.
 *
 * Compartilhar um balde só significaria que exportar várias vezes trava a
 * restauração — e a restauração é justamente o que se faz na pior hora
 * possível, depois de perder dados, provavelmente logo depois de exportar o
 * que sobrou. Bloquear ali seria bloquear no único momento em que a pessoa
 * não pode esperar uma hora.
 */
export const vaultRestoreRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: authUserKey,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas de restauração. Tente novamente daqui a pouco.",
    },
  },
});
