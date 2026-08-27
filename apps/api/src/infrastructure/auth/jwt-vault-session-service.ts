import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import {
  VAULT_SESSION_SCOPE,
  type VaultSessionClaims,
  type VaultSessionService,
} from "../../domain/services/vault-session-service.js";

// Mesmo endurecimento do access token: algoritmo fixo, nunca inferido do
// header do token.
const ALGORITHM = "HS256" as const;

/**
 * Sessão elevada do Cofre em JWT curto, assinado com segredo próprio.
 *
 * Sem segredo configurado o serviço nasce `configured: false` e `sign`
 * recusa -- o módulo inteiro fica fechado. Ver o comentário de
 * VAULT_SESSION_SECRET em config/env.ts sobre por que aqui a degradação é
 * fechar, e não virar no-op como nos outros opcionais.
 */
export class JwtVaultSessionService implements VaultSessionService {
  readonly configured: boolean;
  private readonly secret: string;

  constructor() {
    this.secret = env.VAULT_SESSION_SECRET ?? "";
    this.configured = this.secret.length > 0;
  }

  sign(input: { ownerUserId: string; vaultId: string }): {
    token: string;
    expiresInSeconds: number;
  } {
    if (!this.configured) {
      // Inalcançável pelas rotas (o middleware fecha antes), mas explodir aqui
      // é melhor que assinar com string vazia se algum caminho novo esquecer
      // de checar `configured`.
      throw new Error("VAULT_SESSION_SECRET não configurado.");
    }

    const token = jwt.sign(
      { sub: input.ownerUserId, vaultId: input.vaultId, scope: VAULT_SESSION_SCOPE },
      this.secret,
      { expiresIn: env.VAULT_SESSION_TTL, algorithm: ALGORITHM } as jwt.SignOptions,
    );

    // O expiresIn aceita formato humano ("15m"); em vez de reimplementar o
    // parser, lê de volta o `exp` que a própria lib calculou.
    const decoded = jwt.decode(token);
    const exp = typeof decoded === "object" && decoded !== null ? decoded.exp : undefined;
    const expiresInSeconds =
      typeof exp === "number" ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : 0;

    return { token, expiresInSeconds };
  }

  verify(token: string): VaultSessionClaims | null {
    if (!this.configured) return null;
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: [ALGORITHM] });
      if (typeof decoded === "string") return null;

      const { sub, vaultId, scope, iat } = decoded;
      // O escopo é conferido explicitamente: um token assinado com este
      // segredo mas emitido pra outra finalidade (se algum dia existir) não
      // pode abrir o Cofre por acidente.
      if (scope !== VAULT_SESSION_SCOPE) return null;
      if (typeof sub !== "string" || typeof vaultId !== "string" || typeof iat !== "number") {
        return null;
      }
      return { sub, vaultId, scope: VAULT_SESSION_SCOPE, iat };
    } catch {
      return null;
    }
  }
}
