import type {
  PersonalCurrency,
  PersonalSplitKind,
  PersonalTransaction,
  PersonalTransactionDirection,
  PersonalTransactionSource,
  PersonalTransactionStatus,
} from "../entities/personal-finance.js";

/**
 * Movimentações e suas divisões.
 *
 * As divisões não têm repositório próprio: elas não existem fora de uma
 * movimentação, e trocá-las é sempre "substitui o conjunto inteiro numa
 * transação de banco" — nunca inserir uma solta. Um repositório separado
 * convidaria a gravar metade do rateio.
 */

export interface CreateTransactionInput {
  /** Exatamente um dos dois; o CHECK do banco recusa os dois ou nenhum. */
  accountId: string | null;
  cardId: string | null;
  transactionDate: Date;
  settlementDate: Date | null;
  originalDescription: string;
  normalizedDescription: string;
  merchantId: string | null;
  categoryId: string | null;
  direction: PersonalTransactionDirection;
  amount: string;
  currency: PersonalCurrency;
  originalAmount: string | null;
  originalCurrency: PersonalCurrency | null;
  amountBrl: string;
  source: PersonalTransactionSource;
  /** Lote de importação de origem. Nulo em lançamento manual. */
  importBatchId: string | null;
  externalId: string | null;
  /** Nulo em lançamento manual — ver o comentário do campo no schema. */
  fingerprint: string | null;
  status: PersonalTransactionStatus;
  note: string | null;
  statementId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  isTransfer: boolean;
}

export type UpdateTransactionInput = Partial<
  Pick<
    CreateTransactionInput,
    | "transactionDate"
    | "settlementDate"
    | "merchantId"
    | "categoryId"
    | "note"
    | "status"
    | "isTransfer"
    | "statementId"
    | "installmentNumber"
    | "installmentTotal"
  >
>;

export interface SplitInput {
  kind: PersonalSplitKind;
  amount: string;
  categoryId: string | null;
  note: string | null;
}

/** Regime de leitura: competência usa `transactionDate`, caixa usa
 *  `settlementDate`. Nunca misturar os dois sem rótulo — ver a documentação. */
export type PersonalDateBasis = "ACCRUAL" | "CASH";

export interface TransactionFilters {
  from?: Date;
  to?: Date;
  basis: PersonalDateBasis;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  merchantId?: string;
  statementId?: string;
  /** Movimentações de um lote de importação — usado pela classificação logo
   *  depois de confirmar a importação. */
  importBatchId?: string;
  status?: PersonalTransactionStatus;
  direction?: PersonalTransactionDirection;
  /** `false` esconde transferências e pagamento de fatura dos totais de gasto. */
  includeTransfers?: boolean;
  /** Busca na descrição original e na normalizada. */
  search?: string;
  page: number;
  pageSize: number;
}

export interface TransactionPage {
  items: PersonalTransaction[];
  total: number;
}

/** Uma linha pronta pra gravar já com as divisões (usado pela importação). */
export interface TransactionWithSplits {
  transaction: CreateTransactionInput;
  splits: SplitInput[];
}

export interface PersonalTransactionRepository {
  list(vaultId: string, filters: TransactionFilters): Promise<TransactionPage>;
  findById(vaultId: string, id: string): Promise<PersonalTransaction | null>;
  /** Divisões de várias movimentações de uma vez — evita N+1 na listagem. */
  listSplitsFor(
    vaultId: string,
    transactionIds: string[],
  ): Promise<Map<string, import("../entities/personal-finance.js").PersonalTransactionSplit[]>>;

  create(vaultId: string, input: CreateTransactionInput): Promise<PersonalTransaction>;
  update(
    vaultId: string,
    id: string,
    patch: UpdateTransactionInput,
  ): Promise<PersonalTransaction | null>;
  /** Apaga a movimentação e, em cascata, suas divisões. A confirmação e o
   *  tratamento de despesa empresarial vinculada são do service (fase 7). */
  delete(vaultId: string, id: string): Promise<boolean>;

  /** Liga as duas pernas de uma transferência, uma apontando pra outra, numa
   *  transação de banco. Método próprio em vez de abrir `transferPairId` no
   *  update genérico: o vínculo só faz sentido aos pares, e um update solto
   *  deixaria uma perna apontando pra outra que não aponta de volta. */
  linkTransferPair(vaultId: string, firstId: string, secondId: string): Promise<void>;

  /** Substitui TODAS as divisões numa transação de banco. Não existe "adicionar
   *  uma divisão": rateio pela metade é rateio errado. */
  replaceSplits(vaultId: string, transactionId: string, splits: SplitInput[]): Promise<boolean>;

  /** Insere um lote de importação de uma vez, PULANDO o que colidir com o
   *  unique `(vaultId, fingerprint)`. Devolve quantas linhas entraram de
   *  verdade.
   *
   *  É esta trava — e não a checagem de duplicatas da pré-visualização — que
   *  garante a idempotência: entre a conferência e a confirmação passam
   *  minutos, e nesse intervalo a mesma linha pode ter entrado por outro
   *  caminho. A checagem é pra você VER as duplicatas antes; o unique é o que
   *  impede que elas entrem. */
  createManyFromImport(vaultId: string, rows: CreateTransactionInput[]): Promise<number>;

  /** Fingerprints que já existem, dentre os oferecidos — é a consulta que a
   *  pré-visualização da importação (fase 3) usa pra mostrar as duplicatas
   *  ANTES de confirmar. */
  findExistingFingerprints(vaultId: string, fingerprints: string[]): Promise<Set<string>>;

  /** Como uma movimentação anterior com o MESMO identificador externo foi
   *  classificada. Nível 1 da cascata: reimportar um FITID já revisado devolve
   *  a classificação que você deu, em vez de recomeçar do zero. */
  findClassificationByExternalId(
    vaultId: string,
    origin: { accountId: string | null; cardId: string | null },
    externalId: string,
  ): Promise<{ merchantId: string | null; categoryId: string | null } | null>;

  /** Como a mesma descrição normalizada já foi classificada antes, agrupado.
   *  Devolve os grupos crus — quem decide se há recorrência é
   *  `resolveRecurrence`, que é puro e testável. */
  listClassificationHistory(
    vaultId: string,
    normalizedDescription: string,
    excludeTransactionId: string | null,
  ): Promise<Array<{ categoryId: string | null; merchantId: string | null; count: number }>>;

  /** Soma dos valores em BRL das movimentações de uma fatura (recalcula o
   *  total sem confiar num acumulador que pode dessincronizar). */
  sumByStatement(vaultId: string, statementId: string): Promise<string>;
}
