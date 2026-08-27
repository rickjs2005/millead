import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
  NotFoundError,
  UnauthorizedError,
  VaultLockedError,
} from "../../../domain/errors/app-error.js";
import type { PersonalVaultRepository } from "../../../domain/repositories/personal-vault-repository.js";
import type { VaultSessionService } from "../../../domain/services/vault-session-service.js";

/** Header que carrega a sessão elevada. O navegador nunca o monta: quem
 *  anexa é o BFF do Next, a partir de um cookie httpOnly. */
export const VAULT_SESSION_HEADER = "x-vault-session";
/** Header de resposta com a sessão renovada -- é o que faz os 15 minutos
 *  serem de INATIVIDADE e não de sessão. O BFF regrava o cookie e não
 *  repassa este header ao navegador. */
export const VAULT_SESSION_RENEW_HEADER = "x-vault-session-renew";

/**
 * Segunda barreira do Cofre. Roda DEPOIS de `authenticate` e exige as duas
 * coisas ao mesmo tempo: sessão normal válida E sessão elevada válida do
 * MESMO usuário.
 *
 * Tudo que dá errado aqui vira 404, nunca 403: um 403 confirmaria que o
 * recurso existe. A única exceção é sessão elevada ausente/expirada com Cofre
 * legítimo -- aí o dono precisa saber que é só reautenticar, e a resposta é
 * 401 com código próprio pro front abrir a tela de desbloqueio.
 */
export function createRequireVault(
  vaults: PersonalVaultRepository,
  sessions: VaultSessionService,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sem VAULT_SESSION_SECRET o módulo inteiro não existe. Fecha em vez de
      // degradar -- ver config/env.ts.
      if (!sessions.configured) throw new NotFoundError("Rota não encontrada.");

      const auth = req.auth;
      if (!auth) throw new UnauthorizedError("Requer autenticação.");

      const vault = await vaults.findByOwner(auth.userId);
      if (!vault || !vault.enabled) throw new NotFoundError("Rota não encontrada.");

      const raw = req.headers[VAULT_SESSION_HEADER];
      const token = typeof raw === "string" && raw.length > 0 ? raw : null;
      if (!token) throw new VaultLockedError("Cofre bloqueado. Reautentique para abrir.");

      const claims = sessions.verify(token);
      if (!claims) throw new VaultLockedError("Cofre bloqueado. Reautentique para abrir.");

      // As DUAS identidades têm que bater. Sem esta linha, um token de Cofre
      // roubado bastaria sozinho -- o atacante entraria com a própria conta e
      // leria o Cofre de quem teve o token vazado.
      if (claims.sub !== auth.userId || claims.vaultId !== vault.id) {
        throw new NotFoundError("Rota não encontrada.");
      }

      // Revogação server-side: "Bloquear agora" e logout empurram o corte pra
      // frente, e todo token emitido antes dele morre na hora.
      if (
        vault.sessionsInvalidatedAt &&
        claims.iat * 1000 < vault.sessionsInvalidatedAt.getTime()
      ) {
        throw new VaultLockedError("Cofre bloqueado. Reautentique para abrir.");
      }

      req.vault = { vaultId: vault.id, ownerUserId: auth.userId };

      // Renova a cada request autorizada: é isso que transforma o TTL de 15
      // minutos em "15 minutos PARADO" em vez de "15 minutos de sessão".
      // Assinar um JWT é um HMAC -- barato o bastante pra fazer sempre e não
      // valer a complexidade de renovar só perto do vencimento.
      const renewed = sessions.sign({ ownerUserId: auth.userId, vaultId: vault.id });
      res.setHeader(VAULT_SESSION_RENEW_HEADER, renewed.token);

      next();
    } catch (err) {
      next(err);
    }
  };
}
