import { Prisma, prisma } from "@millead/database";
import type {
  PersonalTransaction,
  PersonalTransactionSplit,
} from "../../domain/entities/personal-finance.js";
import type {
  CreateTransactionInput,
  PersonalTransactionRepository,
  SplitInput,
  TransactionFilters,
  TransactionPage,
  UpdateTransactionInput,
} from "../../domain/repositories/personal-transaction-repository.js";

const transactionSelect = {
  id: true,
  vaultId: true,
  accountId: true,
  cardId: true,
  transactionDate: true,
  settlementDate: true,
  originalDescription: true,
  normalizedDescription: true,
  merchantId: true,
  categoryId: true,
  direction: true,
  amount: true,
  currency: true,
  originalAmount: true,
  originalCurrency: true,
  amountBrl: true,
  source: true,
  importBatchId: true,
  subscriptionId: true,
  externalId: true,
  fingerprint: true,
  status: true,
  note: true,
  statementId: true,
  installmentNumber: true,
  installmentTotal: true,
  isTransfer: true,
  transferPairId: true,
  // Relação 1:1 com a baixa de dívida — um join, não uma consulta a mais por
  // linha. É o que sustenta "Pix de quitação não é renda" nas listagens.
  debtSettlement: { select: { debtId: true } },
  createdAt: true,
  updatedAt: true,
} as const;

const splitSelect = {
  id: true,
  transactionId: true,
  kind: true,
  amount: true,
  categoryId: true,
  note: true,
} as const;

type TransactionRow = Prisma.PersonalTransactionGetPayload<{ select: typeof transactionSelect }>;
type SplitRow = Prisma.PersonalTransactionSplitGetPayload<{ select: typeof splitSelect }>;

function toTransaction(row: TransactionRow): PersonalTransaction {
  const { debtSettlement, ...rest } = row;
  return {
    ...rest,
    amount: row.amount.toString(),
    originalAmount: row.originalAmount?.toString() ?? null,
    amountBrl: row.amountBrl.toString(),
    settlesDebtId: debtSettlement?.debtId ?? null,
  };
}

function toSplit(row: SplitRow): PersonalTransactionSplit {
  return { ...row, amount: row.amount.toString() };
}

export class PrismaPersonalTransactionRepository implements PersonalTransactionRepository {
  async list(vaultId: string, filters: TransactionFilters): Promise<TransactionPage> {
    const where = buildWhere(vaultId, filters);
    // A ordenação segue o regime pedido: num relatório de caixa, ordenar por
    // data de compra devolveria as linhas fora da ordem em que o dinheiro se
    // moveu.
    const dateField = filters.basis === "CASH" ? "settlementDate" : "transactionDate";

    const [items, total] = await Promise.all([
      prisma.personalTransaction.findMany({
        where,
        select: transactionSelect,
        orderBy: [{ [dateField]: "desc" }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.personalTransaction.count({ where }),
    ]);

    return { items: items.map(toTransaction), total };
  }

  async findById(vaultId: string, id: string): Promise<PersonalTransaction | null> {
    const row = await prisma.personalTransaction.findFirst({
      where: { id, vaultId },
      select: transactionSelect,
    });
    return row ? toTransaction(row) : null;
  }

  async listSplitsFor(
    vaultId: string,
    transactionIds: string[],
  ): Promise<Map<string, PersonalTransactionSplit[]>> {
    const grouped = new Map<string, PersonalTransactionSplit[]>();
    if (transactionIds.length === 0) return grouped;

    // Uma consulta pra todas as linhas da página. Buscar divisão por
    // movimentação seria N+1 numa tela que existe pra listar muitas.
    const rows = await prisma.personalTransactionSplit.findMany({
      where: { vaultId, transactionId: { in: transactionIds } },
      select: splitSelect,
      orderBy: { createdAt: "asc" },
    });

    for (const row of rows) {
      const list = grouped.get(row.transactionId) ?? [];
      list.push(toSplit(row));
      grouped.set(row.transactionId, list);
    }
    return grouped;
  }

  async create(vaultId: string, input: CreateTransactionInput): Promise<PersonalTransaction> {
    const row = await prisma.personalTransaction.create({
      data: { vaultId, ...input },
      select: transactionSelect,
    });
    return toTransaction(row);
  }

  async update(
    vaultId: string,
    id: string,
    patch: UpdateTransactionInput,
  ): Promise<PersonalTransaction | null> {
    const { count } = await prisma.personalTransaction.updateMany({
      where: { id, vaultId },
      data: patch,
    });
    if (count === 0) return null;
    return this.findById(vaultId, id);
  }

  async delete(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalTransaction.deleteMany({ where: { id, vaultId } });
    return count > 0;
  }

  async linkTransferPair(vaultId: string, firstId: string, secondId: string): Promise<void> {
    await prisma.$transaction([
      prisma.personalTransaction.updateMany({
        where: { id: firstId, vaultId },
        data: { transferPairId: secondId },
      }),
      prisma.personalTransaction.updateMany({
        where: { id: secondId, vaultId },
        data: { transferPairId: firstId },
      }),
    ]);
  }

  async replaceSplits(
    vaultId: string,
    transactionId: string,
    splits: SplitInput[],
  ): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      // Confere a posse DENTRO da transação: sem isso, a exclusão das divisões
      // antigas poderia rodar contra uma movimentação de outro Cofre.
      const owned = await tx.personalTransaction.count({ where: { id: transactionId, vaultId } });
      if (owned === 0) return false;

      await tx.personalTransactionSplit.deleteMany({ where: { transactionId, vaultId } });
      if (splits.length > 0) {
        await tx.personalTransactionSplit.createMany({
          data: splits.map((split) => ({ vaultId, transactionId, ...split })),
        });
      }
      return true;
    });
  }

  async createManyFromImport(vaultId: string, rows: CreateTransactionInput[]): Promise<number> {
    if (rows.length === 0) return 0;
    // `skipDuplicates` + o unique de fingerprint = importação idempotente no
    // nível do banco. Sem isso, duas confirmações do mesmo lote (duplo clique,
    // retry de rede) criariam a movimentação duas vezes.
    const { count } = await prisma.personalTransaction.createMany({
      data: rows.map((row) => ({ vaultId, ...row })),
      skipDuplicates: true,
    });
    return count;
  }

  async findExistingFingerprints(vaultId: string, fingerprints: string[]): Promise<Set<string>> {
    if (fingerprints.length === 0) return new Set();
    const rows = await prisma.personalTransaction.findMany({
      where: { vaultId, fingerprint: { in: fingerprints } },
      select: { fingerprint: true },
    });
    return new Set(rows.flatMap((row) => (row.fingerprint ? [row.fingerprint] : [])));
  }

  async findClassificationByExternalId(
    vaultId: string,
    origin: { accountId: string | null; cardId: string | null },
    externalId: string,
  ): Promise<{ merchantId: string | null; categoryId: string | null } | null> {
    // Escopado pela origem: FITID é único DENTRO da conta, não no mundo -- dois
    // bancos podem emitir o mesmo "1".
    const row = await prisma.personalTransaction.findFirst({
      where: {
        vaultId,
        externalId,
        accountId: origin.accountId,
        cardId: origin.cardId,
        categoryId: { not: null },
      },
      select: { merchantId: true, categoryId: true },
      orderBy: { updatedAt: "desc" },
    });
    return row ?? null;
  }

  async listClassificationHistory(
    vaultId: string,
    normalizedDescription: string,
    excludeTransactionId: string | null,
  ): Promise<Array<{ categoryId: string | null; merchantId: string | null; count: number }>> {
    // Só o que VOCÊ já confirmou conta como histórico. Incluir linhas ainda
    // pendentes faria uma classificação automática confirmar a si mesma na
    // rodada seguinte.
    const groups = await prisma.personalTransaction.groupBy({
      by: ["categoryId", "merchantId"],
      where: {
        vaultId,
        normalizedDescription,
        status: "CONFIRMED",
        ...(excludeTransactionId ? { id: { not: excludeTransactionId } } : {}),
      },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      categoryId: group.categoryId,
      merchantId: group.merchantId,
      count: group._count._all,
    }));
  }

  async sumByStatement(vaultId: string, statementId: string): Promise<string> {
    // Soma no banco, sempre a partir das linhas -- um acumulador na fatura
    // dessincronizaria assim que uma movimentação fosse editada ou estornada.
    const result = await prisma.personalTransaction.aggregate({
      where: { vaultId, statementId, status: { not: "REVERSED" } },
      _sum: { amountBrl: true },
    });
    return (result._sum.amountBrl ?? new Prisma.Decimal(0)).toString();
  }
}

function buildWhere(
  vaultId: string,
  filters: TransactionFilters,
): Prisma.PersonalTransactionWhereInput {
  const dateField = filters.basis === "CASH" ? "settlementDate" : "transactionDate";
  const range =
    filters.from || filters.to
      ? {
          [dateField]: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lt: filters.to } : {}),
          },
        }
      : {};

  return {
    vaultId,
    ...range,
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.cardId ? { cardId: filters.cardId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.merchantId ? { merchantId: filters.merchantId } : {}),
    ...(filters.statementId ? { statementId: filters.statementId } : {}),
    ...(filters.importBatchId ? { importBatchId: filters.importBatchId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
    // Transferência some por padrão: ela move dinheiro entre bolsos seus e
    // somá-la a um total de gastos infla o número sem nada de errado à vista.
    ...(filters.includeTransfers ? {} : { isTransfer: false }),
    ...(filters.search
      ? {
          OR: [
            { originalDescription: { contains: filters.search, mode: "insensitive" } },
            { normalizedDescription: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
