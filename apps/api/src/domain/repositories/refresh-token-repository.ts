import type { NewRefreshToken, RefreshToken } from "../entities/refresh-token.js";

export interface RefreshTokenRepository {
  create(input: NewRefreshToken): Promise<RefreshToken>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  /**
   * Revoga um token de forma ATÔMICA (`UPDATE ... WHERE id = ? AND
   * revoked_at IS NULL`) e devolve se ESTA chamada foi quem revogou.
   * `false` significa que o token já estava revogado -- seja por uma
   * requisição concorrente que ganhou a corrida (rotação dupla legítima,
   * raro) ou por reuso de um token já gasto (o caso que a detecção de
   * roubo de sessão precisa pegar). O chamador não distingue os dois: em
   * ambos, a ação seguinte é tratar como suspeito.
   */
  revoke(id: string): Promise<boolean>;
  /** Amarra um token revogado ao que o substituiu -- chamado só por quem venceu a corrida em `revoke`. */
  setReplacedBy(id: string, replacedByTokenId: string): Promise<void>;
  /** Revoga toda a família de sessões do usuário -- logout-all / suspeita de roubo de token. */
  revokeAllForUser(userId: string): Promise<void>;
}
