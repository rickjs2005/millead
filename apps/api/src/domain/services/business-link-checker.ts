/**
 * Porta estreita: "esta movimentacao ja virou despesa da MilWeb?".
 *
 * Irma de `DebtLinkChecker`, e pelo mesmo motivo: a FK do elo e
 * `ON DELETE RESTRICT`, e erro de constraint sobe como 500. Perguntar antes
 * transforma isso num 409 que diz o que fazer.
 *
 * Duas portas separadas, e nao uma "TransactionLinkChecker" generica, porque
 * sao duas perguntas de dominios diferentes com respostas diferentes -- e a
 * mensagem de erro de cada uma so faz sentido no seu proprio contexto
 * ("remova a baixa" x "desfaca o envio pro financeiro").
 */
export interface BusinessLinkChecker {
  /** Descricao curta da despesa empresarial gerada, ou `null` se nao ha elo. */
  describeBusinessLink(vaultId: string, transactionId: string): Promise<string | null>;
}
