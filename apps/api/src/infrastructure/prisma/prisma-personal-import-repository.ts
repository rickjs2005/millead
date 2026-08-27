import { Prisma, prisma } from "@millead/database";
import type {
  CreateImportBatchInput,
  CreateImportProfileInput,
  PersonalImportBatch,
  PersonalImportProfile,
  PersonalImportRepository,
  SafeImportError,
  UpdateImportProfileInput,
} from "../../domain/repositories/personal-import-repository.js";

const batchSelect = {
  id: true,
  vaultId: true,
  accountId: true,
  cardId: true,
  format: true,
  fileHash: true,
  fileName: true,
  periodStart: true,
  periodEnd: true,
  totalRows: true,
  importedRows: true,
  duplicateRows: true,
  ignoredRows: true,
  status: true,
  errors: true,
  createdAt: true,
} as const;

const profileSelect = {
  id: true,
  vaultId: true,
  name: true,
  accountId: true,
  cardId: true,
  format: true,
  delimiter: true,
  decimalSeparator: true,
  dateOrder: true,
  hasHeader: true,
  columnMap: true,
  invertSign: true,
} as const;

type BatchRow = Prisma.PersonalImportBatchGetPayload<{ select: typeof batchSelect }>;
type ProfileRow = Prisma.PersonalImportProfileGetPayload<{ select: typeof profileSelect }>;

function toBatch(row: BatchRow): PersonalImportBatch {
  return { ...row, errors: (row.errors as SafeImportError[] | null) ?? [] };
}

function toProfile(row: ProfileRow): PersonalImportProfile {
  return { ...row, columnMap: row.columnMap as Record<string, string | number> };
}

export class PrismaPersonalImportRepository implements PersonalImportRepository {
  async createBatch(vaultId: string, input: CreateImportBatchInput): Promise<PersonalImportBatch> {
    const row = await prisma.personalImportBatch.create({
      data: { vaultId, ...input, errors: input.errors as unknown as Prisma.InputJsonValue },
      select: batchSelect,
    });
    return toBatch(row);
  }

  async updateBatchResult(
    vaultId: string,
    id: string,
    result: {
      importedRows: number;
      duplicateRows: number;
      ignoredRows: number;
      status: "COMPLETED" | "PARTIAL" | "FAILED";
    },
  ): Promise<PersonalImportBatch | null> {
    const { count } = await prisma.personalImportBatch.updateMany({
      where: { id, vaultId },
      data: result,
    });
    if (count === 0) return null;
    return this.findBatch(vaultId, id);
  }

  async countLinkedTransactions(
    vaultId: string,
    batchIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (batchIds.length === 0) return new Map();

    // Um `groupBy` só, e não uma contagem por lote: a tela lista vinte
    // importações, e vinte consultas seriam vinte idas ao banco remoto.
    const grupos = await prisma.personalTransaction.groupBy({
      by: ["importBatchId"],
      where: { vaultId, importBatchId: { in: [...batchIds] } },
      _count: { _all: true },
    });

    const mapa = new Map<string, number>();
    for (const id of batchIds) mapa.set(id, 0);
    for (const grupo of grupos) {
      if (grupo.importBatchId) mapa.set(grupo.importBatchId, grupo._count._all);
    }
    return mapa;
  }

  async findBlockedTransactions(
    vaultId: string,
    batchId: string,
  ): Promise<Array<{ description: string; motivo: "divida" | "milweb" }>> {
    const rows = await prisma.personalTransaction.findMany({
      where: {
        vaultId,
        importBatchId: batchId,
        // As duas FKs com Restrict que apontam pra movimentação.
        OR: [{ debtSettlement: { isNot: null } }, { businessAllocation: { isNot: null } }],
      },
      select: {
        originalDescription: true,
        debtSettlement: { select: { id: true } },
      },
      take: 20,
    });

    return rows.map((row) => ({
      description: row.originalDescription,
      motivo: row.debtSettlement ? ("divida" as const) : ("milweb" as const),
    }));
  }

  async deleteBatchWithTransactions(vaultId: string, batchId: string): Promise<number> {
    return prisma.$transaction(async (tx) => {
      // As movimentações primeiro: a FK delas pro lote é SetNull, então apagar
      // o lote antes as deixaria órfãs e a segunda parte não teria mais como
      // encontrá-las.
      const { count } = await tx.personalTransaction.deleteMany({
        where: { vaultId, importBatchId: batchId },
      });
      await tx.personalImportBatch.deleteMany({ where: { id: batchId, vaultId } });
      return count;
    });
  }

  async listBatches(vaultId: string, limit: number): Promise<PersonalImportBatch[]> {
    const rows = await prisma.personalImportBatch.findMany({
      where: { vaultId },
      select: batchSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toBatch);
  }

  async findBatch(vaultId: string, id: string): Promise<PersonalImportBatch | null> {
    const row = await prisma.personalImportBatch.findFirst({
      where: { id, vaultId },
      select: batchSelect,
    });
    return row ? toBatch(row) : null;
  }

  async findBatchByHash(
    vaultId: string,
    origin: { accountId: string | null; cardId: string | null },
    fileHash: string,
  ): Promise<PersonalImportBatch | null> {
    const row = await prisma.personalImportBatch.findFirst({
      where: { vaultId, fileHash, accountId: origin.accountId, cardId: origin.cardId },
      select: batchSelect,
      orderBy: { createdAt: "desc" },
    });
    return row ? toBatch(row) : null;
  }

  async listProfiles(vaultId: string): Promise<PersonalImportProfile[]> {
    const rows = await prisma.personalImportProfile.findMany({
      where: { vaultId },
      select: profileSelect,
      orderBy: { name: "asc" },
    });
    return rows.map(toProfile);
  }

  async findProfile(vaultId: string, id: string): Promise<PersonalImportProfile | null> {
    const row = await prisma.personalImportProfile.findFirst({
      where: { id, vaultId },
      select: profileSelect,
    });
    return row ? toProfile(row) : null;
  }

  async createProfile(
    vaultId: string,
    input: CreateImportProfileInput,
  ): Promise<PersonalImportProfile> {
    const row = await prisma.personalImportProfile.create({
      data: { vaultId, ...input, columnMap: input.columnMap as Prisma.InputJsonValue },
      select: profileSelect,
    });
    return toProfile(row);
  }

  async updateProfile(
    vaultId: string,
    id: string,
    patch: UpdateImportProfileInput,
  ): Promise<PersonalImportProfile | null> {
    const { count } = await prisma.personalImportProfile.updateMany({
      where: { id, vaultId },
      data: {
        ...patch,
        ...(patch.columnMap ? { columnMap: patch.columnMap as Prisma.InputJsonValue } : {}),
      },
    });
    if (count === 0) return null;
    return this.findProfile(vaultId, id);
  }

  async deleteProfile(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalImportProfile.deleteMany({ where: { id, vaultId } });
    return count > 0;
  }
}
