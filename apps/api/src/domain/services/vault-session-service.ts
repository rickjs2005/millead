/**
 * Sessão elevada do Cofre. É deliberadamente um token SEPARADO do access
 * token, com segredo próprio (`VAULT_SESSION_SECRET`) e escopo fixo: um
 * access token válido não abre o Cofre, e um token de Cofre não serve pra
 * mais nada no resto da API.
 */
export const VAULT_SESSION_SCOPE = "personal-finance" as const;

export interface VaultSessionClaims {
  sub: string; // ownerUserId
  vaultId: string;
  scope: typeof VAULT_SESSION_SCOPE;
  /** Emissão, em segundos (padrão JWT). Comparada com
   *  `PersonalVault.sessionsInvalidatedAt` pra revogação server-side. */
  iat: number;
}

export interface VaultSessionService {
  sign(input: { ownerUserId: string; vaultId: string }): {
    token: string;
    expiresInSeconds: number;
  };
  /** Null pra token inválido, expirado ou de escopo errado -- nunca lança. */
  verify(token: string): VaultSessionClaims | null;
  /** False quando o segredo não está configurado: o módulo inteiro fica
   *  fechado (404), em vez de aberto sem sessão elevada. */
  readonly configured: boolean;
}
