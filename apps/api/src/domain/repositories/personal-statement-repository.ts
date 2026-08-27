import type { PersonalStatement, PersonalStatementStatus } from "../entities/personal-finance.js";

/**
 * Faturas de cartão. Uma por cartão e mês de referência — o unique
 * `(cardId, referenceMonth)` é quem garante isso, e é ele que faz o
 * `ensureForPeriod` abaixo ser seguro sob concorrência: duas importações
 * simultâneas do mesmo mês não criam duas faturas.
 */

export interface EnsureStatementInput {
  cardId: string;
  referenceMonth: Date;
  closingDate: Date;
  dueDate: Date;
}

export interface PersonalStatementRepository {
  list(vaultId: string, cardId?: string): Promise<PersonalStatement[]>;
  findById(vaultId: string, id: string): Promise<PersonalStatement | null>;

  /** Devolve a fatura do período, criando-a se ainda não existir. Upsert pelo
   *  unique, não "consulta e depois insere" — a segunda forma perde a corrida
   *  quando duas linhas do mesmo arquivo caem no mesmo mês. */
  ensureForPeriod(vaultId: string, input: EnsureStatementInput): Promise<PersonalStatement>;

  /** Grava o total recalculado a partir das movimentações vinculadas. O total
   *  nunca é incrementado a cada lançamento: um acumulador dessincroniza em
   *  silêncio quando uma movimentação é editada, apagada ou estornada. */
  updateTotal(vaultId: string, id: string, totalAmount: string): Promise<PersonalStatement | null>;

  /** Registra pagamento (parcial ou total) e o status resultante. */
  registerPayment(
    vaultId: string,
    id: string,
    paidAmount: string,
    status: PersonalStatementStatus,
  ): Promise<PersonalStatement | null>;
}
