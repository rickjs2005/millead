/**
 * Porta estreita pra classificar o que uma importação acabou de gravar.
 *
 * Existe pra que o serviço de importação não passe a depender do serviço de
 * classificação inteiro (regras, correção manual, cascata) só pra disparar uma
 * passada — ele conhece um verbo, não um agregado. Mesmo padrão do
 * `VaultLocker` e do `VaultProvisioner`.
 */
export interface ClassifierRunSummary {
  processadas: number;
  classificadas: number;
  pendentes: number;
}

export interface TransactionClassifier {
  /** Passa a cascata nas movimentações de um lote de importação. */
  runForBatch(vaultId: string, importBatchId: string): Promise<ClassifierRunSummary>;
}
