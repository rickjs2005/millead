import type { PermissionKey } from "@millead/database/permissions";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../../../domain/errors/app-error.js";

/** Deve rodar DEPOIS de `authenticate` -- assume que `req.auth` já existe. */
export function requirePermission(permission: PermissionKey): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      next(new UnauthorizedError("Requer autenticação."));
      return;
    }
    if (!req.auth.permissions.includes(permission)) {
      next(new ForbiddenError(`Permissão necessária: ${permission}.`));
      return;
    }
    next();
  };
}
