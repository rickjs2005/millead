/**
 * Raiz do Cofre Financeiro. Um por usuário -- ver o comentário do modelo em
 * schema.prisma sobre por que este agregado não tem `organizationId`.
 */
export interface PersonalVault {
  id: string;
  ownerUserId: string;
  enabled: boolean;
  failedAttempts: number;
  lockedUntil: Date | null;
  lastUnlockedAt: Date | null;
  /** Todo token de sessão elevada emitido antes deste instante é recusado. */
  sessionsInvalidatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * O que a API devolve sobre o Cofre. Não carrega nada financeiro -- é
 * consultado pela tela bloqueada, ANTES do desbloqueio, e por isso não pode
 * revelar saldo, contagem de transações nem qualquer agregado.
 */
export interface PersonalVaultStatus {
  enabled: boolean;
  /** Instante até o qual novas tentativas são recusadas (null = liberado). */
  lockedUntil: Date | null;
  /** Tentativas restantes antes do próximo bloqueio. */
  attemptsRemaining: number;
}
