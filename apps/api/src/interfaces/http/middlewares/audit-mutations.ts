import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { AuditLogger } from "../../../application/services/audit-logger.js";
import { getRequestMeta } from "../request-meta.js";
import { AUTOMATION_USER_ID } from "./api-key-or-session.js";

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const VERB_BY_METHOD: Record<string, string> = {
  POST: "create",
  PATCH: "update",
  PUT: "update",
  DELETE: "delete",
};

/** "/api/v1/leads/123/notes" -> "leads". Fallback "http" se não casar o padrão. */
function resourceFromPath(path: string): string {
  return /^\/api\/v1\/([^/]+)/.exec(path)?.[1] ?? "http";
}

/**
 * Audita TODA mutação autenticada bem-sucedida (POST/PATCH/PUT/DELETE 2xx) num
 * ponto único -- accountability de "quem alterou o quê" no CRM sem espalhar
 * chamadas de audit em ~15 serviços. A ação vira `<recurso>.<verbo>` (ex.:
 * `leads.delete`, `contracts.update`, `ai.create`) pra ficar consultável.
 *
 * Fica de fora de propósito:
 * - Rotas `/api/v1/auth/*`: têm audit semântico próprio (login/register/logout);
 *   auditar de novo aqui duplicaria.
 * - Mutações SEM `req.auth` (wizard público de briefing, form público de
 *   contrato): não têm ator, então "quem" seria nulo -- ruído sem valor.
 * - Respostas não-2xx: erros de validação/permissão não são mutações efetivadas.
 *
 * Usa `res.on("finish")`: `req.auth` (setado pelo `authenticate` da rota) e o
 * status final só existem depois que a resposta é enviada. Como a resposta já
 * saiu, a gravação é fire-and-forget -- uma falha de audit nunca derruba a
 * requisição.
 */
export function createAuditMutationsMiddleware(auditLogger: AuditLogger): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    res.on("finish", () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const auth = req.auth;
      if (!auth) return;

      const path = req.originalUrl.split("?")[0] ?? req.path;
      if (path.startsWith("/api/v1/auth")) return;
      // Cofre Financeiro: excluído porque esta trilha é da ORGANIZAÇÃO
      // (grava `auth.organizationId`), e atividade do Cofre não pertence à
      // empresa -- registrá-la aqui colocaria a vida financeira pessoal do
      // dono num log de escopo corporativo. O módulo audita por conta
      // própria, com `organizationId: null` e sem nenhum valor
      // (PersonalVaultService.auditContext).
      if (path.startsWith("/api/v1/vault")) return;

      const resource = resourceFromPath(path);
      const verb = VERB_BY_METHOD[req.method] ?? req.method.toLowerCase();
      const entityId = typeof req.params.id === "string" ? req.params.id : undefined;

      // O ator de automação (X-Automation-Key) não é um `users.id` real --
      // gravar "automation" direto em AuditLog.userId quebraria a FK e fazia
      // TODA mutação automatizada falhar de audit em silêncio (fire-and-forget
      // engolia o erro). Grava userId null e marca o ator nos metadados.
      const isAutomation = auth.userId === AUTOMATION_USER_ID;

      void auditLogger
        .log(
          {
            organizationId: auth.organizationId,
            userId: isAutomation ? null : auth.userId,
            ...getRequestMeta(req),
          },
          `${resource}.${verb}`,
          {
            entityType: resource,
            entityId,
            metadata: {
              method: req.method,
              path,
              status: res.statusCode,
              ...(isAutomation ? { actor: "automation" } : {}),
            },
          },
        )
        .catch(() => {
          // best-effort -- a resposta já foi enviada.
        });
    });

    next();
  };
}
