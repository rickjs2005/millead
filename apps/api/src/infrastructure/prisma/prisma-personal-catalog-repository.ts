import { Prisma, prisma } from "@millead/database";
import type {
  PersonalCategory,
  PersonalMerchant,
  PersonalMerchantWithAliases,
} from "../../domain/entities/personal-finance.js";
import type {
  CreateCategoryInput,
  CreateMerchantInput,
  PersonalCatalogRepository,
  UpdateCategoryInput,
  UpdateMerchantInput,
} from "../../domain/repositories/personal-catalog-repository.js";

const categorySelect = {
  id: true,
  vaultId: true,
  parentId: true,
  name: true,
  systemKey: true,
  color: true,
  sortOrder: true,
  isActive: true,
} as const;

const merchantSelect = {
  id: true,
  vaultId: true,
  name: true,
  defaultCategoryId: true,
  isActive: true,
} as const;

const merchantWithAliasesSelect = {
  ...merchantSelect,
  aliases: { select: { id: true, merchantId: true, alias: true }, orderBy: { alias: "asc" } },
} as const;

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function isForeignKeyViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003";
}

export class PrismaPersonalCatalogRepository implements PersonalCatalogRepository {
  // ----- Categorias -----

  async listCategories(vaultId: string, includeInactive: boolean): Promise<PersonalCategory[]> {
    return prisma.personalCategory.findMany({
      where: { vaultId, ...(includeInactive ? {} : { isActive: true }) },
      select: categorySelect,
      // Pais e filhas na mesma lista, ordenadas de forma estável -- quem monta
      // a árvore é o service, com os dados que já vieram numa consulta só.
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findCategory(vaultId: string, id: string): Promise<PersonalCategory | null> {
    return prisma.personalCategory.findFirst({ where: { id, vaultId }, select: categorySelect });
  }

  async findCategoryBySystemKey(
    vaultId: string,
    systemKey: string,
  ): Promise<PersonalCategory | null> {
    return prisma.personalCategory.findFirst({
      where: { vaultId, systemKey },
      select: categorySelect,
    });
  }

  async createCategory(vaultId: string, input: CreateCategoryInput): Promise<PersonalCategory> {
    return prisma.personalCategory.create({
      // systemKey nulo: só as categorias criadas junto com o Cofre têm chave.
      data: { vaultId, ...input, systemKey: null },
      select: categorySelect,
    });
  }

  async updateCategory(
    vaultId: string,
    id: string,
    patch: UpdateCategoryInput,
  ): Promise<PersonalCategory | null> {
    const { count } = await prisma.personalCategory.updateMany({
      where: { id, vaultId },
      // `systemKey` fora do patch de propósito: renomear é seu direito, trocar
      // a chave que a lógica usa pra achar "Transferências" não é.
      data: patch,
    });
    if (count === 0) return null;
    return this.findCategory(vaultId, id);
  }

  async deleteCategory(vaultId: string, id: string): Promise<boolean> {
    try {
      const { count } = await prisma.personalCategory.deleteMany({ where: { id, vaultId } });
      return count > 0;
    } catch (err) {
      // Subcategoria (Restrict) ou uso em movimentação/divisão.
      if (isForeignKeyViolation(err)) return false;
      throw err;
    }
  }

  async countCategoryUsage(vaultId: string, id: string): Promise<number> {
    const [transactions, splits, children, merchants] = await Promise.all([
      prisma.personalTransaction.count({ where: { vaultId, categoryId: id } }),
      prisma.personalTransactionSplit.count({ where: { vaultId, categoryId: id } }),
      prisma.personalCategory.count({ where: { vaultId, parentId: id } }),
      prisma.personalMerchant.count({ where: { vaultId, defaultCategoryId: id } }),
    ]);
    return transactions + splits + children + merchants;
  }

  /**
   * Cria a árvore padrão. Idempotente pelo unique `(vaultId, systemKey)`:
   * chamar de novo não duplica nem sobrescreve o que você já renomeou.
   *
   * Pais primeiro, filhas depois -- a lista já chega ordenada assim, mas a
   * inserção é em duas etapas porque `createMany` não resolve o `parentId` de
   * uma linha que está sendo inserida no mesmo lote.
   */
  async seedCategories(
    vaultId: string,
    items: readonly {
      systemKey: string;
      name: string;
      parentKey: string | null;
      sortOrder: number;
    }[],
  ): Promise<void> {
    const parents = items.filter((item) => item.parentKey === null);
    await prisma.personalCategory.createMany({
      data: parents.map((item) => ({
        vaultId,
        systemKey: item.systemKey,
        name: item.name,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });

    const created = await prisma.personalCategory.findMany({
      where: { vaultId, systemKey: { in: parents.map((p) => p.systemKey) } },
      select: { id: true, systemKey: true },
    });
    const idByKey = new Map(created.map((row) => [row.systemKey, row.id]));

    const children = items.filter((item) => item.parentKey !== null);
    await prisma.personalCategory.createMany({
      data: children.flatMap((item) => {
        const parentId = idByKey.get(item.parentKey!);
        // Pai ausente só aconteceria se alguém tivesse apagado a categoria mãe
        // -- pular é melhor que criar uma subcategoria órfã na raiz.
        return parentId
          ? [
              {
                vaultId,
                parentId,
                systemKey: item.systemKey,
                name: item.name,
                sortOrder: item.sortOrder,
              },
            ]
          : [];
      }),
      skipDuplicates: true,
    });
  }

  // ----- Fornecedores -----

  async listMerchants(
    vaultId: string,
    includeInactive: boolean,
  ): Promise<PersonalMerchantWithAliases[]> {
    return prisma.personalMerchant.findMany({
      where: { vaultId, ...(includeInactive ? {} : { isActive: true }) },
      select: merchantWithAliasesSelect,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  async findMerchant(vaultId: string, id: string): Promise<PersonalMerchantWithAliases | null> {
    return prisma.personalMerchant.findFirst({
      where: { id, vaultId },
      select: merchantWithAliasesSelect,
    });
  }

  async createMerchant(vaultId: string, input: CreateMerchantInput): Promise<PersonalMerchant> {
    return prisma.personalMerchant.create({
      data: {
        vaultId,
        name: input.name,
        defaultCategoryId: input.defaultCategoryId,
        aliases: { create: input.aliases.map((alias) => ({ vaultId, alias })) },
      },
      select: merchantSelect,
    });
  }

  async updateMerchant(
    vaultId: string,
    id: string,
    patch: UpdateMerchantInput,
  ): Promise<PersonalMerchant | null> {
    const { count } = await prisma.personalMerchant.updateMany({
      where: { id, vaultId },
      data: patch,
    });
    if (count === 0) return null;
    return prisma.personalMerchant.findFirst({ where: { id, vaultId }, select: merchantSelect });
  }

  async deleteMerchant(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalMerchant.deleteMany({ where: { id, vaultId } });
    return count > 0;
  }

  async addAlias(
    vaultId: string,
    merchantId: string,
    alias: string,
  ): Promise<PersonalMerchant | null> {
    const merchant = await prisma.personalMerchant.findFirst({
      where: { id: merchantId, vaultId },
      select: merchantSelect,
    });
    if (!merchant) return null;

    try {
      await prisma.personalMerchantAlias.create({ data: { vaultId, merchantId, alias } });
      return merchant;
    } catch (err) {
      // O unique `(vaultId, alias)` é quem decide que o alias já é de outro
      // fornecedor -- uma leitura anterior perderia a corrida entre dois
      // cadastros simultâneos.
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  async removeAlias(vaultId: string, merchantId: string, aliasId: string): Promise<boolean> {
    const { count } = await prisma.personalMerchantAlias.deleteMany({
      where: { id: aliasId, merchantId, vaultId },
    });
    return count > 0;
  }

  async findMerchantByAlias(vaultId: string, alias: string): Promise<PersonalMerchant | null> {
    const row = await prisma.personalMerchantAlias.findFirst({
      where: { vaultId, alias },
      select: { merchant: { select: merchantSelect } },
    });
    return row?.merchant ?? null;
  }
}
