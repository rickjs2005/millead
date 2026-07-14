import type { MembershipContext } from "../../../domain/entities/membership.js";

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate` -- ausente em rotas públicas. */
      auth?: MembershipContext;
      /** Preenchido pelo middleware `validateQuery` -- o controller faz o cast pro tipo esperado. */
      validatedQuery?: unknown;
    }
  }
}

export {};
