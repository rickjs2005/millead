import type {
  PersonalAccount,
  PersonalCreditCard,
} from "../../domain/entities/personal-finance.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  CreateAccountInput,
  CreateCardInput,
  PersonalAccountRepository,
  UpdateAccountInput,
  UpdateCardInput,
} from "../../domain/repositories/personal-account-repository.js";

/**
 * Contas e cartões do Cofre.
 *
 * Service (não N use-cases) pelo critério do ARCHITECTURE.md: é um agregado com
 * CRUD e duas regras de verdade — a conta de pagamento do cartão precisa ser
 * deste mesmo Cofre, e cadastro com movimentação não se apaga, se desativa.
 *
 * `vaultId` vem sempre de `req.vault`, nunca do corpo da requisição.
 */
export class PersonalAccountService {
  constructor(private readonly repository: PersonalAccountRepository) {}

  // ----- Contas -----

  listAccounts(vaultId: string, includeInactive: boolean): Promise<PersonalAccount[]> {
    return this.repository.listAccounts(vaultId, includeInactive);
  }

  async getAccount(vaultId: string, id: string): Promise<PersonalAccount> {
    const account = await this.repository.findAccount(vaultId, id);
    if (!account) throw new NotFoundError("Conta não encontrada.");
    return account;
  }

  createAccount(vaultId: string, input: CreateAccountInput): Promise<PersonalAccount> {
    return this.repository.createAccount(vaultId, input);
  }

  async updateAccount(
    vaultId: string,
    id: string,
    patch: UpdateAccountInput,
  ): Promise<PersonalAccount> {
    const updated = await this.repository.updateAccount(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Conta não encontrada.");
    return updated;
  }

  async deleteAccount(vaultId: string, id: string): Promise<void> {
    await this.getAccount(vaultId, id);
    const deleted = await this.repository.deleteAccount(vaultId, id);
    if (!deleted) {
      // A conta existe mas tem histórico. Apagar levaria as movimentações
      // junto (ou quebraria a FK) -- e perder lançamento financeiro em
      // silêncio é o pior desfecho possível aqui.
      throw new ConflictError(
        "Esta conta tem movimentações registradas. Desative-a em vez de apagar — o histórico continua valendo nos relatórios.",
      );
    }
  }

  // ----- Cartões -----

  listCards(vaultId: string, includeInactive: boolean): Promise<PersonalCreditCard[]> {
    return this.repository.listCards(vaultId, includeInactive);
  }

  async getCard(vaultId: string, id: string): Promise<PersonalCreditCard> {
    const card = await this.repository.findCard(vaultId, id);
    if (!card) throw new NotFoundError("Cartão não encontrado.");
    return card;
  }

  async createCard(vaultId: string, input: CreateCardInput): Promise<PersonalCreditCard> {
    await this.assertPaymentAccount(vaultId, input.paymentAccountId);
    return this.repository.createCard(vaultId, input);
  }

  async updateCard(
    vaultId: string,
    id: string,
    patch: UpdateCardInput,
  ): Promise<PersonalCreditCard> {
    if (patch.paymentAccountId !== undefined) {
      await this.assertPaymentAccount(vaultId, patch.paymentAccountId);
    }
    const updated = await this.repository.updateCard(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Cartão não encontrado.");
    return updated;
  }

  async deleteCard(vaultId: string, id: string): Promise<void> {
    await this.getCard(vaultId, id);
    const deleted = await this.repository.deleteCard(vaultId, id);
    if (!deleted) {
      throw new ConflictError(
        "Este cartão tem movimentações registradas. Desative-o em vez de apagar — as faturas antigas continuam valendo.",
      );
    }
  }

  /**
   * A conta que paga a fatura tem que ser deste Cofre. Sem esta checagem, um id
   * de conta alheia no corpo da requisição criaria um vínculo entre Cofres —
   * a FK do banco sozinha não impede, porque ela só exige que a conta exista.
   */
  private async assertPaymentAccount(vaultId: string, accountId: string | null): Promise<void> {
    if (!accountId) return;
    const account = await this.repository.findAccount(vaultId, accountId);
    if (!account) throw new ValidationError("Conta de pagamento não encontrada neste Cofre.");
  }
}
