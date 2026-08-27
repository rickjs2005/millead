import { Prisma, prisma } from "@millead/database";
import type {
  CreateContactInput,
  CreateDebtInput,
  CreatePaymentInput,
  DebtFilters,
  DebtPayment,
  PersonalContact,
  PersonalDebt,
  PersonalDebtRepository,
  UpdateContactInput,
  UpdateDebtInput,
} from "../../domain/repositories/personal-debt-repository.js";
import { formatMoney, parseMoney } from "../../application/services/vault-money.js";

const contactSelect = {
  id: true,
  vaultId: true,
  name: true,
  contact: true,
  notes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const paymentSelect = {
  id: true,
  debtId: true,
  amount: true,
  paidAt: true,
  transactionId: true,
  note: true,
  createdAt: true,
} as const;

const debtSelect = {
  id: true,
  vaultId: true,
  contactId: true,
  direction: true,
  description: true,
  originalAmount: true,
  currency: true,
  dueDate: true,
  originTransactionId: true,
  canceledAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  contact: { select: { name: true } },
  // Mais antiga primeiro: a lista de baixas é o histórico da dívida, e
  // histórico se lê na ordem em que aconteceu.
  payments: { select: paymentSelect, orderBy: { paidAt: "asc" } },
} as const;

type PaymentRow = Prisma.PersonalDebtPaymentGetPayload<{ select: typeof paymentSelect }>;
type DebtRow = Prisma.PersonalDebtGetPayload<{ select: typeof debtSelect }>;

function toPayment(row: PaymentRow): DebtPayment {
  const { amount, ...rest } = row;
  return { ...rest, amountCents: parseMoney(amount.toString()) };
}

function toDebt(row: DebtRow): PersonalDebt {
  const { originalAmount, contact, payments, ...rest } = row;
  return {
    ...rest,
    contactName: contact.name,
    originalCents: parseMoney(originalAmount.toString()),
    payments: payments.map(toPayment),
  };
}

export class PrismaPersonalDebtRepository implements PersonalDebtRepository {
  // ----- Pessoas -----

  async listContacts(vaultId: string, includeInactive: boolean): Promise<PersonalContact[]> {
    const rows = await prisma.personalContact.findMany({
      where: { vaultId, ...(includeInactive ? {} : { isActive: true }) },
      select: contactSelect,
      orderBy: { name: "asc" },
    });
    return rows;
  }

  findContactById(vaultId: string, id: string): Promise<PersonalContact | null> {
    return prisma.personalContact.findFirst({ where: { id, vaultId }, select: contactSelect });
  }

  createContact(vaultId: string, input: CreateContactInput): Promise<PersonalContact> {
    return prisma.personalContact.create({ data: { vaultId, ...input }, select: contactSelect });
  }

  async updateContact(
    vaultId: string,
    id: string,
    patch: UpdateContactInput,
  ): Promise<PersonalContact | null> {
    const { count } = await prisma.personalContact.updateMany({
      where: { id, vaultId },
      data: patch,
    });
    if (count === 0) return null;
    return this.findContactById(vaultId, id);
  }

  async deleteContact(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalContact.deleteMany({ where: { id, vaultId } });
    return count > 0;
  }

  countDebtsForContact(vaultId: string, contactId: string): Promise<number> {
    return prisma.personalDebt.count({ where: { vaultId, contactId } });
  }

  // ----- Dívidas -----

  async listDebts(vaultId: string, filters: DebtFilters): Promise<PersonalDebt[]> {
    const rows = await prisma.personalDebt.findMany({
      where: {
        vaultId,
        ...(filters.direction ? { direction: filters.direction } : {}),
        ...(filters.contactId ? { contactId: filters.contactId } : {}),
        ...(filters.includeCanceled ? {} : { canceledAt: null }),
      },
      select: debtSelect,
      // Sem vencimento por último: `nulls: "last"` porque no Postgres NULL é o
      // maior valor em ASC, e sem isso as dívidas sem prazo apareceriam antes
      // das vencidas.
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });

    const debts = rows.map(toDebt);
    // Quitadas são filtradas AQUI, não no `where`: "quitada" é a soma das
    // baixas contra o valor, e o Prisma não compara agregado de relação com
    // coluna. Tentar isso em SQL cru dentro do repositório espalharia a regra
    // de saldo por dois lugares — que é justamente o que este módulo evita.
    if (filters.includeSettled) return debts;
    return debts.filter((d) => sumPayments(d) < d.originalCents);
  }

  async findDebtById(vaultId: string, id: string): Promise<PersonalDebt | null> {
    const row = await prisma.personalDebt.findFirst({ where: { id, vaultId }, select: debtSelect });
    return row ? toDebt(row) : null;
  }

  async createDebt(vaultId: string, input: CreateDebtInput): Promise<PersonalDebt> {
    const { originalCents, ...rest } = input;
    const row = await prisma.personalDebt.create({
      data: { vaultId, ...rest, originalAmount: formatMoney(originalCents) },
      select: debtSelect,
    });
    return toDebt(row);
  }

  async updateDebt(
    vaultId: string,
    id: string,
    patch: UpdateDebtInput,
  ): Promise<PersonalDebt | null> {
    const { originalCents, ...rest } = patch;
    const { count } = await prisma.personalDebt.updateMany({
      where: { id, vaultId },
      data: {
        ...rest,
        ...(originalCents !== undefined ? { originalAmount: formatMoney(originalCents) } : {}),
      },
    });
    if (count === 0) return null;
    return this.findDebtById(vaultId, id);
  }

  async deleteDebt(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalDebt.deleteMany({ where: { id, vaultId } });
    return count > 0;
  }

  // ----- Baixas -----

  async addPayment(
    vaultId: string,
    debtId: string,
    input: CreatePaymentInput,
  ): Promise<PersonalDebt> {
    const { amountCents, ...rest } = input;
    await prisma.personalDebtPayment.create({
      data: { vaultId, debtId, ...rest, amount: formatMoney(amountCents) },
    });
    // Devolve a dívida inteira: quem chamou precisa do saldo e do status novos,
    // e os dois só existem com as baixas do lado.
    const debt = await this.findDebtById(vaultId, debtId);
    if (!debt) throw new Error("Dívida sumiu entre a baixa e a leitura.");
    return debt;
  }

  async deletePayment(vaultId: string, debtId: string, paymentId: string): Promise<boolean> {
    const { count } = await prisma.personalDebtPayment.deleteMany({
      where: { id: paymentId, debtId, vaultId },
    });
    return count > 0;
  }

  async findDebtByTransaction(
    vaultId: string,
    transactionId: string,
  ): Promise<PersonalDebt | null> {
    const payment = await prisma.personalDebtPayment.findFirst({
      where: { vaultId, transactionId },
      select: { debtId: true },
    });
    if (!payment) return null;
    return this.findDebtById(vaultId, payment.debtId);
  }
}

function sumPayments(debt: PersonalDebt): number {
  return debt.payments.reduce((total, p) => total + p.amountCents, 0);
}
