import type { NextFunction, Request, RequestHandler, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";

/**
 * Gate "so o dono ve" do MilSocial. Roda DEPOIS de `authenticate`.
 * req.auth (MembershipContext) nao carrega e-mail, entao resolve o usuario
 * pelo id. Nao-dono recebe 404 (nao 403) de proposito: a rota nem deve
 * parecer existir pra quem nao e o dono. OWNER_EMAIL ausente = ninguem passa.
 */
export function createRequireOwner(
  userRepository: UserRepository,
  ownerEmail: string | undefined,
): RequestHandler {
  const owner = ownerEmail?.trim().toLowerCase();
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new UnauthorizedError("Requer autenticação.");
      }
      if (!owner) {
        throw new NotFoundError("Rota não encontrada.");
      }
      const user = await userRepository.findById(req.auth.userId);
      if (!user || user.email.trim().toLowerCase() !== owner) {
        throw new NotFoundError("Rota não encontrada.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
