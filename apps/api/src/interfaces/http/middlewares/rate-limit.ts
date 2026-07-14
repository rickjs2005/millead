import rateLimit from "express-rate-limit";

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
