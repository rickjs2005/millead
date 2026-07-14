import type { Request } from "express";
import type { MembershipContext } from "../../domain/entities/membership.js";
import { UnauthorizedError } from "../../domain/errors/app-error.js";

/**
 * Toda rota que chama isso já passou pelo middleware `authenticate` --
 * `req.auth` é garantido pelo roteamento, mas o TypeScript não sabe disso
 * (é opcional no tipo). Isola o non-null assertion num só lugar em vez de
 * espalhar `req.auth!` (ou checagens repetidas) em cada controller.
 */
export function requireAuth(req: Request): MembershipContext {
  if (!req.auth) {
    throw new UnauthorizedError("Requer autenticação.");
  }
  return req.auth;
}
