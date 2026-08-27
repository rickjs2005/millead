import type { Request } from "express";
import { NotFoundError } from "../../domain/errors/app-error.js";

export interface VaultContext {
  vaultId: string;
  ownerUserId: string;
}

/**
 * Contexto do Cofre para os controllers. Toda rota que chama isto já passou por
 * `requireVault` — mas o tipo é opcional em `Request`, e isolar o
 * non-null aqui evita `req.vault!` espalhado (o mesmo papel do `requireAuth`).
 *
 * O erro é 404, não 401: se por algum descuido de roteamento um controller do
 * Cofre for alcançado sem o middleware, a resposta continua sendo "esta rota
 * não existe" em vez de confirmar que existe um Cofre ali.
 */
export function requireVaultContext(req: Request): VaultContext {
  if (!req.vault) {
    throw new NotFoundError("Rota não encontrada.");
  }
  return req.vault;
}
