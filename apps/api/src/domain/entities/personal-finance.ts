/**
 * Núcleo do Cofre Financeiro: contas, cartões, categorias, fornecedores,
 * movimentações, divisões e faturas.
 *
 * Convenções que valem para todos os tipos aqui:
 *
 * - **Dinheiro é `string`** (o `Decimal` do Prisma serializa assim). Somar com
 *   `Number()` reintroduz erro de ponto flutuante — use `vault-money.ts`.
 * - **`vaultId`, nunca `ownerUserId`.** Os dois provariam a mesma coisa, mas o
 *   `vaultId` só existe em `req.vault` depois que `requireVault` confirmou a
 *   posse — filtrar por ele é filtrar exatamente pelo que foi autorizado.
 * - **Datas de calendário** (`transactionDate`, `dueDate`…) são `@db.Date`,
 *   sempre construídas em UTC — ver `vault-date.ts` sobre por quê.
 */

export type PersonalAccountType = "CHECKING" | "SAVINGS" | "DIGITAL_WALLET" | "CASH";
export type PersonalCurrency = "BRL" | "USD" | "EUR";
export type PersonalTransactionDirection = "IN" | "OUT";
export type PersonalTransactionSource = "OFX" | "CSV" | "MANUAL";
export type PersonalTransactionStatus = "PENDING" | "CONFIRMED" | "IGNORED" | "REVERSED";
export type PersonalSplitKind = "PERSONAL" | "REIMBURSABLE" | "BUSINESS";
export type PersonalStatementStatus = "OPEN" | "CLOSED" | "PARTIAL" | "PAID" | "OVERDUE";

export interface PersonalAccount {
  id: string;
  vaultId: string;
  name: string;
  institution: string | null;
  type: PersonalAccountType;
  currency: PersonalCurrency;
  /** Só os quatro últimos dígitos existem — nunca o número completo. */
  last4: string | null;
  reportedBalance: string | null;
  reportedBalanceAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalCreditCard {
  id: string;
  vaultId: string;
  name: string;
  institution: string | null;
  /** Nunca número completo, validade ou código de segurança. */
  last4: string | null;
  limitAmount: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PersonalCategory {
  id: string;
  vaultId: string;
  parentId: string | null;
  name: string;
  /** Identificador estável das categorias criadas com o Cofre. Nulo nas suas.
   *  É por ele que a lógica encontra "Transferências" mesmo depois de você
   *  renomear a categoria. */
  systemKey: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** Categoria com as filhas embutidas — como a tela de categorias consome. */
export interface PersonalCategoryTree extends PersonalCategory {
  children: PersonalCategory[];
}

export interface PersonalMerchant {
  id: string;
  vaultId: string;
  name: string;
  defaultCategoryId: string | null;
  isActive: boolean;
}

export interface PersonalMerchantWithAliases extends PersonalMerchant {
  aliases: PersonalMerchantAlias[];
}

export interface PersonalMerchantAlias {
  id: string;
  merchantId: string;
  /** Já normalizado (ver `transaction-text.ts`). */
  alias: string;
}

export interface PersonalTransactionSplit {
  id: string;
  transactionId: string;
  kind: PersonalSplitKind;
  amount: string;
  categoryId: string | null;
  note: string | null;
}

export interface PersonalTransaction {
  id: string;
  vaultId: string;
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
  /** Lote de importação de origem — a procedência da linha. Nulo em
   *  lançamento manual. */
  importBatchId: string | null;
  externalId: string | null;
  fingerprint: string | null;
  status: PersonalTransactionStatus;
  note: string | null;
  statementId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  isTransfer: boolean;
  transferPairId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * O que a API devolve: a movimentação mais o rateio **derivado** das divisões.
 *
 * `isBusiness`, `isReimbursable` e `personalConsumption` não existem no banco —
 * são calculados a partir de `splits` a cada leitura. Guardá-los seria um
 * segundo lugar dizendo a mesma coisa, e é assim que nasce contagem dupla.
 */
export interface PersonalTransactionDetail extends PersonalTransaction {
  splits: PersonalTransactionSplit[];
  isBusiness: boolean;
  isReimbursable: boolean;
  businessAmount: string;
  reimbursableAmount: string;
  personalConsumption: string;
}

export interface PersonalStatement {
  id: string;
  vaultId: string;
  cardId: string;
  referenceMonth: Date;
  closingDate: Date;
  dueDate: Date;
  totalAmount: string;
  paidAmount: string;
  status: PersonalStatementStatus;
}
