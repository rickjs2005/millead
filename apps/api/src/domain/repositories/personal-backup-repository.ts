/**
 * Cópia integral do Cofre — para levar embora, e para trazer de volta.
 *
 * ## Por que as linhas são `Record<string, unknown>`
 *
 * A tentação era declarar cada coluna de cada tabela aqui. O problema é o que
 * acontece na fase seguinte: alguém acrescenta uma coluna ao schema, esquece de
 * acrescentar aqui, e o backup **passa a sair incompleto sem nenhum erro**. A
 * pessoa só descobre no dia em que restaura — e aí não tem mais o dado.
 *
 * Por isso o dump é montado com `omit` (tire `vault_id`), e não com `select`
 * (traga estas colunas). Coluna nova entra no backup sozinha, e o modo de
 * falhar vira "veio coisa demais" em vez de "faltou". Num backup, os dois não
 * são equivalentes.
 *
 * O preço é tipagem fraca aqui. Ela é recuperada onde importa: a planilha
 * declara exatamente os campos que lê (`CsvTransaction`), e a validação do
 * arquivo confere formato e versão antes de qualquer escrita.
 *
 * ## O que sai, e o que fica de fora
 *
 * Sai tudo que é dado: contas, cartões, categorias, fornecedores e apelidos,
 * faturas, movimentações e rateios, lotes de importação, regras, assinaturas,
 * alertas, pessoas, dívidas e baixas.
 *
 * Ficam de fora, de propósito:
 *
 * - **`vaultId`.** O arquivo é seu; carimbar o id do dono em toda linha não
 *   ajuda a restaurar nada e transforma o backup num documento que identifica
 *   você mesmo depois de renomeado.
 * - **Estado de sessão** (tentativas erradas, castigo, corte de sessões). Não
 *   é dado financeiro, é o cadeado — restaurar isso reimportaria um bloqueio
 *   que já passou.
 * - **O conteúdo dos arquivos bancários.** Nunca foi guardado (ver
 *   `personal_import_batches`); vai só o registro da importação.
 * - **As despesas empresariais.** O outro lado da ponte é dado da MilWeb, não
 *   do Cofre. Os envios saem como informação, e a restauração não os recria.
 *
 * ## Ids são preservados
 *
 * São cuids: não dizem nada sobre você, e são o que amarra movimentação a
 * rateio, dívida a baixa, alerta a assinatura. Regerar tudo na restauração
 * exigiria remapear cada referência — mais código, mais chance de ligar a
 * linha errada, nenhum ganho.
 */

/** Uma linha do banco, sem `vaultId`. Ver o comentário acima sobre o tipo. */
export type BackupRow = Record<string, unknown> & { id: string };

/** Linha com filhos embutidos (movimentação + rateios, dívida + baixas). */
export type BackupRowWith<K extends string> = BackupRow & Record<K, BackupRow[]>;

export interface VaultDump {
  categories: BackupRow[];
  accounts: BackupRow[];
  cards: BackupRow[];
  merchants: BackupRowWith<"aliases">[];
  statements: BackupRow[];
  importBatches: BackupRow[];
  subscriptions: BackupRow[];
  transactions: BackupRowWith<"splits">[];
  rules: BackupRow[];
  alerts: BackupRow[];
  contacts: BackupRow[];
  debts: BackupRowWith<"payments">[];
  /** Envios ao financeiro da MilWeb. **Informativo**: a despesa do outro lado é
   *  dado da empresa e não entra no backup do Cofre, então a restauração não
   *  recria o vínculo — recriar metade dele apontaria pra uma despesa que não
   *  existe. */
  businessSends: BackupRow[];
}

export interface RestoreCounts {
  categorias: number;
  contas: number;
  cartoes: number;
  fornecedores: number;
  faturas: number;
  importacoes: number;
  assinaturas: number;
  movimentacoes: number;
  rateios: number;
  regras: number;
  alertas: number;
  pessoas: number;
  dividas: number;
  baixas: number;
  /** Envios que ficaram de fora — sempre igual ao que veio no arquivo. */
  enviosIgnorados: number;
}

export interface PersonalBackupRepository {
  dump(vaultId: string): Promise<VaultDump>;

  /**
   * O Cofre está vazio o bastante pra receber uma restauração?
   *
   * "Vazio" ignora as categorias padrão — elas nascem com o Cofre e a
   * restauração as substitui. Qualquer outra coisa (conta, cartão,
   * movimentação, dívida…) significa que já existe história ali.
   */
  isEmpty(vaultId: string): Promise<boolean>;

  /**
   * Restaura tudo numa transação de banco só.
   *
   * Tudo ou nada, sem exceção: uma restauração pela metade deixaria
   * movimentações apontando pra contas que não entraram, e o estrago seria
   * pior que a falha original — a pessoa só descobriria semanas depois, ao
   * abrir uma tela que ficou sem sentido.
   */
  restore(vaultId: string, dump: VaultDump): Promise<RestoreCounts>;
}
