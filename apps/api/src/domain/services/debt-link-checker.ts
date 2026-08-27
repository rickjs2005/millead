/**
 * Porta estreita: "esta movimentação está baixando alguma dívida?".
 *
 * Existe porque apagar uma movimentação vinculada a uma baixa esbarra no
 * `ON DELETE RESTRICT` do banco, e um erro de constraint sobe como 500 — foi
 * exatamente assim que a exclusão de conta quebrou na fase anterior. Perguntar
 * antes transforma isso num 409 que diz o que fazer.
 *
 * É uma porta, e não uma injeção do serviço de dívidas inteiro, pelo mesmo
 * motivo de `VaultLocker` e `VaultProvisioner`: o serviço de movimentações
 * precisa de **uma** pergunta, e receber a classe toda deixaria ele capaz de
 * apagar dívidas sem nada no tipo denunciando isso.
 */
export interface DebtLinkChecker {
  /** Descrição curta da dívida baixada, ou `null` se não há vínculo. */
  describeDebtLink(vaultId: string, transactionId: string): Promise<string | null>;
}
