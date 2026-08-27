import type { MembershipContext } from "../../../domain/entities/membership.js";

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate` -- ausente em rotas públicas. */
      auth?: MembershipContext;
      /** Preenchido pelo middleware `validateQuery` -- o controller faz o cast pro tipo esperado. */
      validatedQuery?: unknown;
      /** Preenchido pelo middleware `requireVault` -- presente SÓ nas rotas do
       *  Cofre, e só com sessão elevada válida. Um controller do Cofre que
       *  filtre por `req.auth.userId` em vez de `req.vault.ownerUserId` está
       *  pulando a segunda barreira: os dois coincidem, mas só o segundo prova
       *  que a reautenticação aconteceu. */
      vault?: { vaultId: string; ownerUserId: string };
    }
  }
}

export {};
