import type { PersonalVault } from "../entities/personal-vault.js";

export interface PersonalVaultRepository {
  /** Única forma de buscar um Cofre: pelo dono. Não existe `findById` de
   *  propósito -- um id não prova posse, e um repositório que aceitasse id
   *  puro seria a porta pra alguém consultar o Cofre alheio se um controller
   *  esquecesse a checagem. */
  findByOwner(ownerUserId: string): Promise<PersonalVault | null>;
  /** Cria o Cofre do usuário. Retorna null se ele já tiver um (o unique de
   *  `ownerUserId` é quem decide, não uma leitura anterior -- duas
   *  requisições concorrentes não podem criar dois). */
  create(ownerUserId: string): Promise<PersonalVault | null>;
  /** Incrementa o contador de falhas ATOMICAMENTE e devolve o novo valor.
   *  Atômico porque um `lê -> soma -> grava` na aplicação permitiria a quem
   *  dispara tentativas em paralelo sobrescrever o próprio contador e nunca
   *  chegar ao bloqueio. */
  incrementFailedAttempts(ownerUserId: string): Promise<number>;
  /** Grava o bloqueio decidido pela política (`lockoutFor`). */
  setLockedUntil(ownerUserId: string, lockedUntil: Date | null): Promise<void>;
  /** Zera contador/bloqueio e marca o desbloqueio. */
  registerSuccessfulUnlock(ownerUserId: string, unlockedAt: Date): Promise<void>;
  /** Corta todas as sessões elevadas emitidas antes de `at` ("Bloquear
   *  agora" e logout). */
  invalidateSessions(ownerUserId: string, at: Date): Promise<void>;
}
