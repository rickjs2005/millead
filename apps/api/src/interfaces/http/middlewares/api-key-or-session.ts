import { timingSafeEqual } from "node:crypto";
import type { PermissionKey } from "@millead/database/permissions";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthorizedError } from "../../../domain/errors/app-error.js";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a),
    bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Valor sintético usado em `req.auth.userId` pra requests autenticados via
 * X-Automation-Key -- NÃO é um id de `users` real (não tem linha na tabela),
 * então nada que grave `userId` como FK (ex.: AuditLog) pode usar isso direto.
 * Exportado pra `audit-mutations.ts` reconhecer esse ator sem duplicar a
 * string mágica.
 */
export const AUTOMATION_USER_ID = "automation";

/**
 * Rotas de automação (ex.: sync do project-checklist a partir das skills do
 * Claude Code) aceitam DUAS formas de auth: sessão normal (JWT) OU header
 * X-Automation-Key. Header presente decide a rota na hora -- inválido é 401
 * direto, sem fallback pra sessão (mesmo desenho do ownerOrSyncKey do
 * MilSocial, ver interfaces/http/routes/social-routes.ts).
 */
export function apiKeyOrSession(
  apiKey: string | undefined,
  organizationId: string | undefined,
  permissions: readonly PermissionKey[],
  authenticate: RequestHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["x-automation-key"];
    if (typeof header === "string") {
      if (apiKey && organizationId && safeEqual(header, apiKey)) {
        req.auth = {
          id: AUTOMATION_USER_ID,
          userId: AUTOMATION_USER_ID,
          organizationId,
          roleId: AUTOMATION_USER_ID,
          status: "ACTIVE",
          organizationName: "Automação",
          organizationSlug: "automation",
          roleName: "Automação",
          permissions: [...permissions],
          userIsActive: true,
        };
        next();
        return;
      }
      next(new UnauthorizedError("Chave de automação inválida."));
      return;
    }
    authenticate(req, res, next);
  };
}
