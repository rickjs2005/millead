import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  // pino-http loga req.headers por padrão -- sem isso, todo access token
  // (Authorization: Bearer ...) e cookie de sessão vai parar em texto puro
  // nos logs estruturados (e de lá, provavelmente num agregador de logs).
  redact: {
    paths: [
      "req.headers.authorization",
      'req.headers["set-cookie"]',
      "req.headers.cookie",
      "res.headers['set-cookie']",
    ],
    censor: "[redacted]",
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});
