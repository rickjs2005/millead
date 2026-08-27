import { Prisma, prisma } from "@millead/database";
import type {
  PersonalStatement,
  PersonalStatementStatus,
} from "../../domain/entities/personal-finance.js";
import type {
  EnsureStatementInput,
  PersonalStatementRepository,
} from "../../domain/repositories/personal-statement-repository.js";

const statementSelect = {
  id: true,
  vaultId: true,
  cardId: true,
  referenceMonth: true,
  closingDate: true,
  dueDate: true,
  totalAmount: true,
  paidAmount: true,
  status: true,
} as const;

type StatementRow = Prisma.PersonalStatementGetPayload<{ select: typeof statementSelect }>;

function toStatement(row: StatementRow): PersonalStatement {
  return {
    ...row,
    totalAmount: row.totalAmount.toString(),
    paidAmount: row.paidAmount.toString(),
  };
}

export class PrismaPersonalStatementRepository implements PersonalStatementRepository {
  async list(vaultId: string, cardId?: string): Promise<PersonalStatement[]> {
    const rows = await prisma.personalStatement.findMany({
      where: { vaultId, ...(cardId ? { cardId } : {}) },
      select: statementSelect,
      orderBy: { referenceMonth: "desc" },
    });
    return rows.map(toStatement);
  }

  async findById(vaultId: string, id: string): Promise<PersonalStatement | null> {
    const row = await prisma.personalStatement.findFirst({
      where: { id, vaultId },
      select: statementSelect,
    });
    return row ? toStatement(row) : null;
  }

  async ensureForPeriod(vaultId: string, input: EnsureStatementInput): Promise<PersonalStatement> {
    // Upsert pelo unique `(cardId, referenceMonth)`: duas linhas do mesmo
    // arquivo caindo no mesmo mês não podem criar duas faturas, e um
    // "consulta e depois insere" perde essa corrida.
    //
    // O `update` só reafirma as datas: se você corrigir o dia de fechamento do
    // cartão, a fatura já existente passa a refletir isso. Totais e status
    // ficam de fora -- quem manda neles é o recálculo a partir das linhas.
    const row = await prisma.personalStatement.upsert({
      where: {
        cardId_referenceMonth: { cardId: input.cardId, referenceMonth: input.referenceMonth },
      },
      create: {
        vaultId,
        cardId: input.cardId,
        referenceMonth: input.referenceMonth,
        closingDate: input.closingDate,
        dueDate: input.dueDate,
      },
      update: { closingDate: input.closingDate, dueDate: input.dueDate },
      select: statementSelect,
    });
    return toStatement(row);
  }

  async updateTotal(
    vaultId: string,
    id: string,
    totalAmount: string,
  ): Promise<PersonalStatement | null> {
    const { count } = await prisma.personalStatement.updateMany({
      where: { id, vaultId },
      data: { totalAmount },
    });
    if (count === 0) return null;
    return this.findById(vaultId, id);
  }

  async registerPayment(
    vaultId: string,
    id: string,
    paidAmount: string,
    status: PersonalStatementStatus,
  ): Promise<PersonalStatement | null> {
    const { count } = await prisma.personalStatement.updateMany({
      where: { id, vaultId },
      data: { paidAmount, status },
    });
    if (count === 0) return null;
    return this.findById(vaultId, id);
  }
}
