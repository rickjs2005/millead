import { prisma, Prisma } from "@millead/database";
import type { Receivable } from "../../domain/entities/receivable.js";
import type {
  CreatePlanItem,
  CreateStandaloneItem,
  ReceivableRepository,
} from "../../domain/repositories/receivable-repository.js";

const receivableSelect = {
  id: true,
  organizationId: true,
  contractId: true,
  description: true,
  kind: true,
  installmentIndex: true,
  amount: true,
  dueDate: true,
  paidAt: true,
  paidNote: true,
} as const;

type ReceivableRow = Prisma.ReceivableGetPayload<{ select: typeof receivableSelect }>;

function toDomain(row: ReceivableRow): Receivable {
  return { ...row, amount: row.amount.toString() };
}

export class PrismaReceivableRepository implements ReceivableRepository {
  async createPlan(
    organizationId: string,
    contractId: string,
    items: CreatePlanItem[],
  ): Promise<Receivable[] | null> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.receivable.count({ where: { organizationId, contractId } });
      if (existing > 0) return null;

      await tx.receivable.createMany({
        data: items.map((item) => ({
          organizationId,
          contractId,
          kind: item.kind,
          installmentIndex: item.installmentIndex,
          amount: item.amount,
          dueDate: item.dueDate,
        })),
      });

      const rows = await tx.receivable.findMany({
        where: { organizationId, contractId },
        select: receivableSelect,
        orderBy: { installmentIndex: "asc" },
      });
      return rows.map(toDomain);
    });
  }

  async createStandalone(organizationId: string, item: CreateStandaloneItem): Promise<Receivable> {
    // installmentIndex sempre 0 aqui: o `@@unique([contractId, installmentIndex])`
    // do schema não conflita porque contractId é null -- Postgres trata cada
    // NULL como distinto num índice único composto, então múltiplas avulsas
    // (contractId=null, installmentIndex=0) coexistem sem violar a
    // constraint (que só barra duplicidade dentro do MESMO contrato).
    const row = await prisma.receivable.create({
      data: {
        organizationId,
        contractId: null,
        description: item.description,
        kind: "AVULSA",
        installmentIndex: 0,
        amount: item.amount,
        dueDate: item.dueDate,
        paidAt: item.paidAt,
      },
      select: receivableSelect,
    });
    return toDomain(row);
  }

  async listStandalone(organizationId: string): Promise<Receivable[]> {
    const rows = await prisma.receivable.findMany({
      where: { organizationId, kind: "AVULSA", contractId: null },
      select: receivableSelect,
      orderBy: { dueDate: "desc" },
    });
    return rows.map(toDomain);
  }

  async listByContract(organizationId: string, contractId: string): Promise<Receivable[]> {
    const rows = await prisma.receivable.findMany({
      where: { organizationId, contractId },
      select: receivableSelect,
      orderBy: { installmentIndex: "asc" },
    });
    return rows.map(toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Receivable | null> {
    const row = await prisma.receivable.findFirst({
      where: { id, organizationId },
      select: receivableSelect,
    });
    return row ? toDomain(row) : null;
  }

  async markPaid(
    organizationId: string,
    id: string,
    paidAt: Date,
    paidNote: string | null,
  ): Promise<Receivable | null> {
    const { count } = await prisma.receivable.updateMany({
      where: { id, organizationId, paidAt: null },
      data: { paidAt, paidNote },
    });
    if (count === 0) return null;
    const row = await prisma.receivable.findUniqueOrThrow({
      where: { id },
      select: receivableSelect,
    });
    return toDomain(row);
  }

  async markUnpaid(organizationId: string, id: string): Promise<Receivable | null> {
    const { count } = await prisma.receivable.updateMany({
      where: { id, organizationId, paidAt: { not: null } },
      data: { paidAt: null, paidNote: null },
    });
    if (count === 0) return null;
    const row = await prisma.receivable.findUniqueOrThrow({
      where: { id },
      select: receivableSelect,
    });
    return toDomain(row);
  }

  async update(
    organizationId: string,
    id: string,
    patch: { amount?: string; description?: string; dueDate?: Date },
  ): Promise<Receivable | null> {
    const { count } = await prisma.receivable.updateMany({
      where: { id, organizationId, paidAt: null },
      data: patch,
    });
    if (count === 0) return null;
    const row = await prisma.receivable.findUniqueOrThrow({
      where: { id },
      select: receivableSelect,
    });
    return toDomain(row);
  }

  async delete(organizationId: string, id: string): Promise<boolean> {
    const { count } = await prisma.receivable.deleteMany({
      where: { id, organizationId, paidAt: null },
    });
    return count > 0;
  }

  async hasPaid(organizationId: string, contractId: string): Promise<boolean> {
    const count = await prisma.receivable.count({
      where: { organizationId, contractId, paidAt: { not: null } },
    });
    return count > 0;
  }

  async deleteOpenByContract(organizationId: string, contractId: string): Promise<number> {
    const { count } = await prisma.receivable.deleteMany({
      where: { organizationId, contractId, paidAt: null },
    });
    return count;
  }

  async listForSummary(organizationId: string, from: Date, to: Date): Promise<Receivable[]> {
    const rows = await prisma.receivable.findMany({
      where: {
        organizationId,
        OR: [
          { dueDate: { gte: from, lt: to } },
          { paidAt: null, dueDate: { lt: from } },
          // Paga fora do range de vencimento mas dentro do mes consultado
          // (ex.: parcela vencida em junho, paga em agosto) -- sem este
          // ramo o pagamento some do resumo: nao cai em "vencida" (paidAt
          // != null) nem em "a receber" (dueDate fora do mes).
          { paidAt: { gte: from, lt: to } },
        ],
      },
      select: receivableSelect,
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toDomain);
  }

  async listForSeries(organizationId: string, from: Date, to: Date): Promise<Receivable[]> {
    const rows = await prisma.receivable.findMany({
      where: {
        organizationId,
        OR: [{ dueDate: { gte: from, lt: to } }, { paidAt: { gte: from, lt: to } }],
      },
      select: receivableSelect,
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toDomain);
  }

  async sumPaidByContract(organizationId: string, contractId: string): Promise<string> {
    const result = await prisma.receivable.aggregate({
      where: { organizationId, contractId, paidAt: { not: null } },
      _sum: { amount: true },
    });
    return (result._sum.amount ?? new Prisma.Decimal(0)).toString();
  }

  async listContractsWithTotals(organizationId: string): Promise<
    Array<{
      contractId: string;
      numero: string;
      companyName: string;
      total: string;
      paid: string;
      openOverdue: string;
      nextDueDate: Date | null;
    }>
  > {
    // Esta listagem e por CONTRATO -- receita avulsa (contractId null) nao
    // tem contrato pra agrupar, entao fica de fora daqui (aparece na lista
    // separada de avulsas). O filtro `not: null` tambem estreita o tipo do
    // TS: sem ele `g.contractId` seria `string | null` e quebraria as
    // comparacoes abaixo que assumem contrato sempre presente.
    const totalGroups = (
      await prisma.receivable.groupBy({
        by: ["contractId"],
        where: { organizationId, contractId: { not: null } },
        _sum: { amount: true },
      })
    ).filter((g): g is typeof g & { contractId: string } => g.contractId !== null);
    if (totalGroups.length === 0) return [];

    const contractIds = totalGroups.map((g) => g.contractId);
    const now = new Date();

    const [paidGroups, openOverdueGroups, nextDueGroups, contracts] = await Promise.all([
      prisma.receivable.groupBy({
        by: ["contractId"],
        where: { organizationId, contractId: { in: contractIds }, paidAt: { not: null } },
        _sum: { amount: true },
      }),
      prisma.receivable.groupBy({
        by: ["contractId"],
        where: {
          organizationId,
          contractId: { in: contractIds },
          paidAt: null,
          dueDate: { lt: now },
        },
        _sum: { amount: true },
      }),
      prisma.receivable.groupBy({
        by: ["contractId"],
        where: { organizationId, contractId: { in: contractIds }, paidAt: null },
        _min: { dueDate: true },
      }),
      prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: { id: true, numero: true, company: { select: { name: true } } },
      }),
    ]);

    const paidMap = new Map(paidGroups.map((g) => [g.contractId, g._sum?.amount]));
    const openOverdueMap = new Map(openOverdueGroups.map((g) => [g.contractId, g._sum?.amount]));
    const nextDueMap = new Map(nextDueGroups.map((g) => [g.contractId, g._min?.dueDate]));
    const contractMap = new Map(contracts.map((c) => [c.id, c]));

    return totalGroups.map((g) => {
      const contract = contractMap.get(g.contractId);
      return {
        contractId: g.contractId,
        numero: contract?.numero ?? "",
        companyName: contract?.company.name ?? "",
        total: (g._sum.amount ?? new Prisma.Decimal(0)).toString(),
        paid: (paidMap.get(g.contractId) ?? new Prisma.Decimal(0)).toString(),
        openOverdue: (openOverdueMap.get(g.contractId) ?? new Prisma.Decimal(0)).toString(),
        nextDueDate: nextDueMap.get(g.contractId) ?? null,
      };
    });
  }
}
