/**
 * Claims mínimas: identidade + tenant ativo. Propositalmente NÃO carrega
 * permissões -- elas são resolvidas a cada request a partir do banco (via
 * MembershipRepository), pra uma mudança de papel/permissão valer
 * imediatamente e não só depois que o access token (15min) expirar.
 */
export interface AccessTokenClaims {
  sub: string; // userId
  organizationId: string;
}

export interface AccessTokenService {
  sign(claims: AccessTokenClaims): string;
  /** Retorna null se o token for inválido/expirado (nunca lança). */
  verify(token: string): AccessTokenClaims | null;
}
