/**
 * Porta estreita: garantir que a contraparte de uma movimentacao exista.
 *
 * A importacao le "Pix - Samili Linda Morais Perigolo - •••.216.826-••" e sabe
 * que ali ha uma PESSOA. Sem isto, o nome ficava so na descricao e voce teria
 * que cadastrar a mao em Pessoas -- que e exatamente o trabalho manual que a
 * importacao existe pra evitar.
 *
 * E uma porta, e nao os repositorios de catalogo e de dividas injetados no
 * servico de importacao, pelo mesmo motivo de `DebtLinkChecker`: a importacao
 * precisa de DOIS verbos ("garanta esta pessoa", "garanta este fornecedor"), e
 * receber os agregados inteiros a deixaria capaz de apagar divida -- sem nada
 * no tipo denunciando isso.
 */

export interface EnsuredParty {
  id: string;
  /** `true` quando foi criado agora. E o que a tela conta pra te dizer o que
   *  entrou sozinho. */
  created: boolean;
}

export interface PartyRegistry {
  /** Pessoa (CPF no extrato). Idempotente por nome dentro do Cofre. */
  ensurePerson(vaultId: string, name: string): Promise<EnsuredParty>;
  /** Fornecedor (CNPJ ou boleto). Idempotente por nome dentro do Cofre. */
  ensureMerchant(vaultId: string, name: string): Promise<EnsuredParty>;
}
