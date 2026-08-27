import type {
  PersonalAccount,
  PersonalAccountType,
  PersonalCreditCard,
  PersonalCurrency,
} from "../entities/personal-finance.js";

/**
 * Contas e cartões: as duas origens possíveis de uma movimentação. Ficam no
 * mesmo contrato porque toda operação de movimentação precisa resolver "esta
 * origem existe e é deste Cofre?" contra os dois — separá-los faria o service
 * de transações depender de dois repositórios para uma única pergunta.
 *
 * **Todo método recebe `vaultId` como primeiro parâmetro e filtra por ele.**
 * Não existe `findById` sem Cofre: um id sozinho não prova posse, e um método
 * assim seria a porta pra alguém ler o Cofre alheio se um controller esquecesse
 * a checagem.
 */

export interface CreateAccountInput {
  name: string;
  institution: string | null;
  type: PersonalAccountType;
  currency: PersonalCurrency;
  last4: string | null;
  reportedBalance: string | null;
  reportedBalanceAt: Date | null;
}

export type UpdateAccountInput = Partial<CreateAccountInput> & { isActive?: boolean };

export interface CreateCardInput {
  name: string;
  institution: string | null;
  last4: string | null;
  limitAmount: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
}

export type UpdateCardInput = Partial<CreateCardInput> & { isActive?: boolean };

export interface PersonalAccountRepository {
  listAccounts(vaultId: string, includeInactive: boolean): Promise<PersonalAccount[]>;
  findAccount(vaultId: string, id: string): Promise<PersonalAccount | null>;
  createAccount(vaultId: string, input: CreateAccountInput): Promise<PersonalAccount>;
  updateAccount(
    vaultId: string,
    id: string,
    patch: UpdateAccountInput,
  ): Promise<PersonalAccount | null>;
  /** `false` quando a conta tem movimentação (a FK é Restrict) ou não existe.
   *  Apagar histórico financeiro junto com um cadastro seria perda silenciosa —
   *  o caminho para uma conta encerrada é desativar. */
  deleteAccount(vaultId: string, id: string): Promise<boolean>;

  listCards(vaultId: string, includeInactive: boolean): Promise<PersonalCreditCard[]>;
  findCard(vaultId: string, id: string): Promise<PersonalCreditCard | null>;
  createCard(vaultId: string, input: CreateCardInput): Promise<PersonalCreditCard>;
  updateCard(
    vaultId: string,
    id: string,
    patch: UpdateCardInput,
  ): Promise<PersonalCreditCard | null>;
  deleteCard(vaultId: string, id: string): Promise<boolean>;
}
