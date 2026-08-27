import { Prisma, prisma } from "@millead/database";
import type {
  PersonalAccount,
  PersonalCreditCard,
} from "../../domain/entities/personal-finance.js";
import type {
  CreateAccountInput,
  CreateCardInput,
  PersonalAccountRepository,
  UpdateAccountInput,
  UpdateCardInput,
} from "../../domain/repositories/personal-account-repository.js";

const accountSelect = {
  id: true,
  vaultId: true,
  name: true,
  institution: true,
  type: true,
  currency: true,
  last4: true,
  reportedBalance: true,
  reportedBalanceAt: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const cardSelect = {
  id: true,
  vaultId: true,
  name: true,
  institution: true,
  last4: true,
  limitAmount: true,
  closingDay: true,
  dueDay: true,
  paymentAccountId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

type AccountRow = Prisma.PersonalAccountGetPayload<{ select: typeof accountSelect }>;
type CardRow = Prisma.PersonalCreditCardGetPayload<{ select: typeof cardSelect }>;

function toAccount(row: AccountRow): PersonalAccount {
  return { ...row, reportedBalance: row.reportedBalance?.toString() ?? null };
}

function toCard(row: CardRow): PersonalCreditCard {
  return { ...row, limitAmount: row.limitAmount?.toString() ?? null };
}

/**
 * P2003 = violação de FK. Aqui significa "tem movimentação apontando pra este
 * cadastro", porque a relação é `Restrict` de propósito: apagar uma conta não
 * pode levar o histórico financeiro junto.
 */
function isForeignKeyViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

export class PrismaPersonalAccountRepository implements PersonalAccountRepository {
  // ----- Contas -----

  async listAccounts(vaultId: string, includeInactive: boolean): Promise<PersonalAccount[]> {
    const rows = await prisma.personalAccount.findMany({
      where: { vaultId, ...(includeInactive ? {} : { isActive: true }) },
      select: accountSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return rows.map(toAccount);
  }

  async findAccount(vaultId: string, id: string): Promise<PersonalAccount | null> {
    // findFirst com vaultId, e não findUnique por id: um id sozinho não prova
    // posse, e o filtro tem que estar na consulta, não numa checagem depois.
    const row = await prisma.personalAccount.findFirst({
      where: { id, vaultId },
      select: accountSelect,
    });
    return row ? toAccount(row) : null;
  }

  async createAccount(vaultId: string, input: CreateAccountInput): Promise<PersonalAccount> {
    const row = await prisma.personalAccount.create({
      data: { vaultId, ...input },
      select: accountSelect,
    });
    return toAccount(row);
  }

  async updateAccount(
    vaultId: string,
    id: string,
    patch: UpdateAccountInput,
  ): Promise<PersonalAccount | null> {
    // updateMany escopado pelo vaultId: o `update` do Prisma só aceita chave
    // única, e usar só o id exigiria uma checagem separada de posse -- duas
    // consultas onde uma condição basta.
    const { count } = await prisma.personalAccount.updateMany({
      where: { id, vaultId },
      data: patch,
    });
    if (count === 0) return null;
    return this.findAccount(vaultId, id);
  }

  async deleteAccount(vaultId: string, id: string): Promise<boolean> {
    try {
      const { count } = await prisma.personalAccount.deleteMany({ where: { id, vaultId } });
      return count > 0;
    } catch (err) {
      if (isForeignKeyViolation(err)) return false;
      throw err;
    }
  }

  // ----- Cartões -----

  async listCards(vaultId: string, includeInactive: boolean): Promise<PersonalCreditCard[]> {
    const rows = await prisma.personalCreditCard.findMany({
      where: { vaultId, ...(includeInactive ? {} : { isActive: true }) },
      select: cardSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return rows.map(toCard);
  }

  async findCard(vaultId: string, id: string): Promise<PersonalCreditCard | null> {
    const row = await prisma.personalCreditCard.findFirst({
      where: { id, vaultId },
      select: cardSelect,
    });
    return row ? toCard(row) : null;
  }

  async createCard(vaultId: string, input: CreateCardInput): Promise<PersonalCreditCard> {
    const row = await prisma.personalCreditCard.create({
      data: { vaultId, ...input },
      select: cardSelect,
    });
    return toCard(row);
  }

  async updateCard(
    vaultId: string,
    id: string,
    patch: UpdateCardInput,
  ): Promise<PersonalCreditCard | null> {
    const { count } = await prisma.personalCreditCard.updateMany({
      where: { id, vaultId },
      data: patch,
    });
    if (count === 0) return null;
    return this.findCard(vaultId, id);
  }

  async deleteCard(vaultId: string, id: string): Promise<boolean> {
    try {
      const { count } = await prisma.personalCreditCard.deleteMany({ where: { id, vaultId } });
      return count > 0;
    } catch (err) {
      if (isForeignKeyViolation(err)) return false;
      throw err;
    }
  }
}
