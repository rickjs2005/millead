import { prisma } from "@millead/database";
import { formatMoney, parseMoney } from "../../application/services/vault-money.js";
import type {
  BusinessAllocation,
  BusinessExpense,
  BusinessExpenseRepository,
  CreateExpenseInput,
  ExpenseFilters,
  UpdateExpenseInput,
} from "../../domain/repositories/business-expense-repository.js";

const expenseSelect = {
  id: true,
  organizationId: true,
  description: true,
  amount: true,
  currency: true,
  incurredAt: true,
  category: true,
  costSubscriptionId: true,
  companyId: true,
  source: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const allocationSelect = {
  id: true,
  vaultId: true,
  transactionId: true,
  businessExpenseId: true,
  organizationId: true,
  amount: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ExpenseRow = { amount: { toString(): string } } & Omit<BusinessExpense, "amount">;
type AllocationRow = { amount: { toString(): string } } & Omit<BusinessAllocation, "amount">;

/**
 * Dinheiro sempre com duas casas.
 *
 * O `Decimal` do Prisma corta zero à direita: `100.00` volta como `"100"`. Não
 * quebra conta nenhuma (a comparação é em centavos), mas faz o mesmo valor
 * aparecer como "R$ 100" aqui e "R$ 100,00" na tela do Cofre — e numa tela de
 * dinheiro isso lê como dois valores diferentes.
 */
function money(value: { toString(): string }): string {
  return formatMoney(parseMoney(value.toString()));
}

function toExpense(row: ExpenseRow): BusinessExpense {
  return { ...row, amount: money(row.amount) };
}

function toAllocation(row: AllocationRow): BusinessAllocation {
  return { ...row, amount: money(row.amount) };
}

export class PrismaBusinessExpenseRepository implements BusinessExpenseRepository {
  async list(organizationId: string, filters: ExpenseFilters): Promise<BusinessExpense[]> {
    const rows = await prisma.businessExpense.findMany({
      where: {
        organizationId,
        ...(filters.from || filters.to
          ? {
              incurredAt: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
        ...(filters.costSubscriptionId ? { costSubscriptionId: filters.costSubscriptionId } : {}),
        ...(filters.source ? { source: filters.source } : {}),
      },
      select: expenseSelect,
      orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toExpense);
  }

  async findById(organizationId: string, id: string): Promise<BusinessExpense | null> {
    const row = await prisma.businessExpense.findFirst({
      where: { id, organizationId },
      select: expenseSelect,
    });
    return row ? toExpense(row) : null;
  }

  async create(organizationId: string, input: CreateExpenseInput): Promise<BusinessExpense> {
    const row = await prisma.businessExpense.create({
      data: { organizationId, ...input },
      select: expenseSelect,
    });
    return toExpense(row);
  }

  async update(
    organizationId: string,
    id: string,
    patch: UpdateExpenseInput,
  ): Promise<BusinessExpense | null> {
    const { count } = await prisma.businessExpense.updateMany({
      where: { id, organizationId },
      data: patch,
    });
    if (count === 0) return null;
    return this.findById(organizationId, id);
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const { count } = await prisma.businessExpense.deleteMany({ where: { id, organizationId } });
    return count > 0;
  }

  async costSubscriptionExists(
    organizationId: string,
    costSubscriptionId: string,
  ): Promise<boolean> {
    const found = await prisma.costSubscription.findFirst({
      where: { id: costSubscriptionId, organizationId },
      select: { id: true },
    });
    return found !== null;
  }

  // ----- Ponte -----

  async createWithAllocation(
    organizationId: string,
    vaultId: string,
    transactionId: string,
    input: CreateExpenseInput,
  ): Promise<{ expense: BusinessExpense; allocation: BusinessAllocation }> {
    return prisma.$transaction(async (tx) => {
      const expense = await tx.businessExpense.create({
        data: { organizationId, ...input },
        select: expenseSelect,
      });
      const allocation = await tx.personalBusinessAllocation.create({
        data: {
          vaultId,
          transactionId,
          businessExpenseId: expense.id,
          organizationId,
          amount: input.amount,
        },
        select: allocationSelect,
      });
      return { expense: toExpense(expense), allocation: toAllocation(allocation) };
    });
  }

  async findAllocationByTransaction(
    vaultId: string,
    transactionId: string,
  ): Promise<BusinessAllocation | null> {
    const row = await prisma.personalBusinessAllocation.findFirst({
      where: { vaultId, transactionId },
      select: allocationSelect,
    });
    return row ? toAllocation(row) : null;
  }

  async listAllocations(vaultId: string): Promise<BusinessAllocation[]> {
    const rows = await prisma.personalBusinessAllocation.findMany({
      where: { vaultId },
      select: allocationSelect,
    });
    return rows.map(toAllocation);
  }

  async syncAllocation(
    vaultId: string,
    transactionId: string,
    amount: string,
    patch: UpdateExpenseInput,
  ): Promise<{ expense: BusinessExpense; allocation: BusinessAllocation } | null> {
    const existing = await this.findAllocationByTransaction(vaultId, transactionId);
    if (!existing) return null;

    return prisma.$transaction(async (tx) => {
      const expense = await tx.businessExpense.update({
        where: { id: existing.businessExpenseId },
        data: { ...patch, amount },
        select: expenseSelect,
      });
      const allocation = await tx.personalBusinessAllocation.update({
        where: { id: existing.id },
        data: { amount },
        select: allocationSelect,
      });
      return { expense: toExpense(expense), allocation: toAllocation(allocation) };
    });
  }

  async revertAllocation(vaultId: string, transactionId: string): Promise<boolean> {
    const existing = await this.findAllocationByTransaction(vaultId, transactionId);
    if (!existing) return false;
    // Apagar a despesa derruba o elo pelo Cascade -- um delete só, sem janela
    // em que um dos dois já sumiu e o outro não.
    const { count } = await prisma.businessExpense.deleteMany({
      where: { id: existing.businessExpenseId },
    });
    return count > 0;
  }
}
