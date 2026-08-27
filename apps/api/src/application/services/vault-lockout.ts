/**
 * Política de bloqueio do desbloqueio do Cofre. Função pura de propósito: é a
 * regra que decide quando um atacante para de tentar, e regra dessas merece
 * teste direto, sem banco nem HTTP no caminho.
 *
 * Por que escalonar em vez de um limite fixo: um teto fixo ou trava a conta
 * pra sempre (o dono erra a própria senha e fica de fora) ou é curto demais
 * pra atrapalhar quem automatiza. Escalonando, o dono distraído perde um
 * minuto e quem está varrendo senha perde uma hora por tentativa.
 *
 * `lockoutFor` recebe a contagem JÁ INCREMENTADA, não a anterior: quem
 * incrementa é o banco (`incrementFailedAttempts`, atômico), justamente pra
 * que tentativas concorrentes não se sobrescrevam e devolvam fôlego de graça
 * a quem dispara em paralelo.
 */

/** Tentativas erradas toleradas antes do primeiro bloqueio. */
export const MAX_ATTEMPTS_BEFORE_LOCK = 5;

/** Duração do bloqueio, em minutos, por falha adicional a partir do limite. */
const LOCK_STEPS_MINUTES = [1, 5, 15, 60] as const;

/** Até quando o Cofre fica fechado depois da falha de número `failedAttempts`.
 *  Null enquanto ainda houver tentativas no orçamento. */
export function lockoutFor(failedAttempts: number, now: Date): Date | null {
  if (failedAttempts < MAX_ATTEMPTS_BEFORE_LOCK) return null;

  // A falha que atinge o limite usa o degrau 0; cada falha seguinte sobe um
  // degrau e satura no último (nunca afrouxa).
  const step = Math.min(failedAttempts - MAX_ATTEMPTS_BEFORE_LOCK, LOCK_STEPS_MINUTES.length - 1);
  return new Date(now.getTime() + LOCK_STEPS_MINUTES[step]! * 60_000);
}

/** `lockedUntil` no passado (ou igual a agora) já não bloqueia. */
export function isLocked(state: { lockedUntil: Date | null }, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/** Quantas tentativas ainda cabem antes do próximo bloqueio. Nunca negativo. */
export function attemptsRemaining(failedAttempts: number): number {
  return Math.max(0, MAX_ATTEMPTS_BEFORE_LOCK - failedAttempts);
}
