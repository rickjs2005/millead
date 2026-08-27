/**
 * Pessoas, dívidas e baixas.
 *
 * Contrato único porque baixa não existe sem dívida, e dívida não existe sem
 * pessoa: toda leitura útil atravessa os três. Separar em três repositórios
 * renderia três consultas pra montar uma tela que só faz sentido inteira.
 *
 * Valores em **centavos inteiros** na fronteira, como no repositório de
 * assinaturas — quem consome é o cálculo de saldo e status, que trabalha em
 * centavos. A conversão pra string decimal acontece na saída da API.
 *
 * A dívida sempre vem **com as baixas**: saldo e status não existem sem elas, e
 * um `findById` que devolvesse a dívida sozinha convidaria a mostrar uma dívida
 * quitada como se estivesse em aberto.
 */

export type DebtDirection = "THEY_OWE_ME" | "I_OWE_THEM";

export interface PersonalContact {
  id: string;
  vaultId: string;
  name: string;
  contact: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateContactInput {
  name: string;
  contact: string | null;
  notes: string | null;
}

export type UpdateContactInput = Partial<CreateContactInput & { isActive: boolean }>;

export interface DebtPayment {
  id: string;
  debtId: string;
  amountCents: number;
  paidAt: Date;
  transactionId: string | null;
  note: string | null;
  createdAt: Date;
}

export interface PersonalDebt {
  id: string;
  vaultId: string;
  contactId: string;
  contactName: string;
  direction: DebtDirection;
  description: string;
  originalCents: number;
  currency: "BRL" | "USD" | "EUR";
  dueDate: Date | null;
  originTransactionId: string | null;
  canceledAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  payments: DebtPayment[];
}

export interface CreateDebtInput {
  contactId: string;
  direction: DebtDirection;
  description: string;
  originalCents: number;
  currency: "BRL" | "USD" | "EUR";
  dueDate: Date | null;
  originTransactionId: string | null;
  notes: string | null;
}

export type UpdateDebtInput = Partial<
  Omit<CreateDebtInput, "contactId" | "direction"> & { canceledAt: Date | null }
>;

export interface CreatePaymentInput {
  amountCents: number;
  paidAt: Date;
  transactionId: string | null;
  note: string | null;
}

export interface DebtFilters {
  direction: DebtDirection | null;
  contactId: string | null;
  /** Canceladas ficam fora por padrão: são histórico, não pendência. */
  includeCanceled: boolean;
  /** Quitadas idem — a tela padrão é "o que ainda está em aberto". */
  includeSettled: boolean;
}

export interface PersonalDebtRepository {
  // ----- Pessoas -----
  listContacts(vaultId: string, includeInactive: boolean): Promise<PersonalContact[]>;
  findContactById(vaultId: string, id: string): Promise<PersonalContact | null>;
  createContact(vaultId: string, input: CreateContactInput): Promise<PersonalContact>;
  updateContact(
    vaultId: string,
    id: string,
    patch: UpdateContactInput,
  ): Promise<PersonalContact | null>;
  deleteContact(vaultId: string, id: string): Promise<boolean>;
  /** Quantas dívidas a pessoa tem. É o que transforma o Restrict do banco num
   *  409 explicado, em vez de um 500 de constraint. */
  countDebtsForContact(vaultId: string, contactId: string): Promise<number>;

  // ----- Dívidas -----
  listDebts(vaultId: string, filters: DebtFilters): Promise<PersonalDebt[]>;
  findDebtById(vaultId: string, id: string): Promise<PersonalDebt | null>;
  createDebt(vaultId: string, input: CreateDebtInput): Promise<PersonalDebt>;
  updateDebt(vaultId: string, id: string, patch: UpdateDebtInput): Promise<PersonalDebt | null>;
  deleteDebt(vaultId: string, id: string): Promise<boolean>;

  // ----- Baixas -----
  addPayment(vaultId: string, debtId: string, input: CreatePaymentInput): Promise<PersonalDebt>;
  deletePayment(vaultId: string, debtId: string, paymentId: string): Promise<boolean>;
  /** A dívida que esta movimentação baixa, se houver. Sustenta a regra de que
   *  o Pix de quitação não é renda. */
  findDebtByTransaction(vaultId: string, transactionId: string): Promise<PersonalDebt | null>;
}
