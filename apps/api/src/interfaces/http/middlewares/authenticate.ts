import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import type { MembershipRepository } from "../../../domain/repositories/membership-repository.js";
import type { AccessTokenService } from "../../../domain/services/access-token-service.js";

/**
 * Verifica o access token E resolve o contexto do tenant (papel +
 * permissões) num só round-trip -- deixa `req.auth` pronto pra
 * `requirePermission` e pros controllers. Permissões nunca vêm do token
 * (ver AccessTokenClaims): sempre lidas frescas do banco aqui.
 */
export function createAuthenticateMiddleware(
  accessTokenService: AccessTokenService,
  membershipRepository: MembershipRepository,
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
      if (!token) {
        throw new UnauthorizedError("Token de acesso ausente.");
      }

      const claims = accessTokenService.verify(token);
      if (!claims) {
        throw new UnauthorizedError("Token de acesso inválido ou expirado.");
      }

      const context = await membershipRepository.findContext(claims.sub, claims.organizationId);
      if (!context || context.status !== "ACTIVE") {
        throw new ForbiddenError("Acesso a esta organização foi revogado.");
      }
      // Conta desativada perde acesso na hora, sem esperar o access token (15min)
      // expirar. 401 (não 403) de propósito: dispara o refresh no client, que
      // também checa isActive e falha -> logout limpo. Antes, só o refresh
      // checava isActive, então um usuário desativado seguia usando o app até o
      // access token vencer.
      if (!context.userIsActive) {
        throw new UnauthorizedError("Conta desativada.");
      }

      req.auth = context;
      next();
    } catch (err) {
      next(err);
    }
  };
}
