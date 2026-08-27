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
