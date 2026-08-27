import type {
  PersonalCategory,
  PersonalCategoryTree,
  PersonalMerchant,
  PersonalMerchantWithAliases,
} from "../../domain/entities/personal-finance.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type {
  CreateCategoryInput,
  CreateMerchantInput,
  PersonalCatalogRepository,
  UpdateCategoryInput,
  UpdateMerchantInput,
} from "../../domain/repositories/personal-catalog-repository.js";
import type { VaultProvisioner } from "../../domain/services/vault-provisioner.js";
import { flattenDefaults } from "./default-categories.js";
import { normalizeDescription } from "./transaction-text.js";

/**
 * Categorias e fornecedores.
 *
 * Duas regras estruturais moram aqui, e não no banco:
 *
 * 1. **Um nível só de subcategoria.** Postgres aceitaria uma árvore infinita;
 *    o relatório de drill-down, não. Categoria com mãe não pode virar mãe.
 * 2. **Alias sempre normalizado antes de gravar.** Normalizar na escrita é o
 *    que permite o unique `(vaultId, alias)` fazer a deduplicação — se a
 *    normalização ficasse na leitura, "anthropic" e "ANTHROPIC" conviveriam
 *    como aliases diferentes do mesmo fornecedor.
 */
export class PersonalCatalogService implements VaultProvisioner {
  constructor(private readonly repository: PersonalCatalogRepository) {}

  /** Cria a árvore padrão. Idempotente — ver `seedCategories`. */
  seedDefaults(vaultId: string): Promise<void> {
    return this.repository.seedCategories(vaultId, flattenDefaults());
  }

  // ----- Categorias -----

  /** Árvore montada a partir de UMA consulta — mãe com as filhas embutidas. */
  async listCategoryTree(
    vaultId: string,
    includeInactive: boolean,
  ): Promise<PersonalCategoryTree[]> {
    const all = await this.repository.listCategories(vaultId, includeInactive);
    const roots = all.filter((category) => category.parentId === null);
    return roots.map((root) => ({
      ...root,
      children: all.filter((category) => category.parentId === root.id),
    }));
  }

  async getCategory(vaultId: string, id: string): Promise<PersonalCategory> {
    const category = await this.repository.findCategory(vaultId, id);
    if (!category) throw new NotFoundError("Categoria não encontrada.");
    return category;
  }

  async createCategory(vaultId: string, input: CreateCategoryInput): Promise<PersonalCategory> {
    await this.assertParentIsRoot(vaultId, input.parentId);
    return this.repository.createCategory(vaultId, input);
  }

  async updateCategory(
    vaultId: string,
    id: string,
    patch: UpdateCategoryInput,
  ): Promise<PersonalCategory> {
    if (patch.parentId !== undefined) {
      if (patch.parentId === id) {
        throw new ValidationError("Uma categoria não pode ser mãe de si mesma.");
      }
      await this.assertParentIsRoot(vaultId, patch.parentId);
      // Categoria que já tem filhas não pode virar subcategoria: isso criaria
      // o segundo nível pela porta dos fundos.
      if (patch.parentId !== null) {
        const tree = await this.listCategoryTree(vaultId, true);
        const asRoot = tree.find((root) => root.id === id);
        if (asRoot && asRoot.children.length > 0) {
          throw new ValidationError(
            "Esta categoria tem subcategorias. Mova ou remova as subcategorias antes de torná-la uma subcategoria.",
          );
        }
      }
    }

    const updated = await this.repository.updateCategory(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Categoria não encontrada.");
    return updated;
  }

  async deleteCategory(vaultId: string, id: string): Promise<void> {
    await this.getCategory(vaultId, id);
    const usage = await this.repository.countCategoryUsage(vaultId, id);
    if (usage > 0) {
      throw new ConflictError(
        `Esta categoria está em uso em ${usage} ${usage === 1 ? "registro" : "registros"}. Desative-a em vez de apagar — apagar deixaria lançamentos antigos sem classificação e mudaria relatórios já fechados.`,
      );
    }
    const deleted = await this.repository.deleteCategory(vaultId, id);
    if (!deleted) throw new NotFoundError("Categoria não encontrada.");
  }

  // ----- Fornecedores -----

  listMerchants(vaultId: string, includeInactive: boolean): Promise<PersonalMerchantWithAliases[]> {
    return this.repository.listMerchants(vaultId, includeInactive);
  }

  async getMerchant(vaultId: string, id: string): Promise<PersonalMerchantWithAliases> {
    const merchant = await this.repository.findMerchant(vaultId, id);
    if (!merchant) throw new NotFoundError("Fornecedor não encontrado.");
    return merchant;
  }

  async createMerchant(vaultId: string, input: CreateMerchantInput): Promise<PersonalMerchant> {
    await this.assertCategory(vaultId, input.defaultCategoryId);
    const aliases = dedupe(input.aliases.map(normalizeDescription).filter(Boolean));
    return this.repository.createMerchant(vaultId, { ...input, aliases });
  }

  async updateMerchant(
    vaultId: string,
    id: string,
    patch: UpdateMerchantInput,
  ): Promise<PersonalMerchant> {
    if (patch.defaultCategoryId !== undefined) {
      await this.assertCategory(vaultId, patch.defaultCategoryId);
    }
    const updated = await this.repository.updateMerchant(vaultId, id, patch);
    if (!updated) throw new NotFoundError("Fornecedor não encontrado.");
    return updated;
  }

  async deleteMerchant(vaultId: string, id: string): Promise<void> {
    const deleted = await this.repository.deleteMerchant(vaultId, id);
    if (!deleted) throw new NotFoundError("Fornecedor não encontrado.");
  }

  async addAlias(vaultId: string, merchantId: string, rawAlias: string): Promise<PersonalMerchant> {
    const alias = normalizeDescription(rawAlias);
    if (!alias) throw new ValidationError("Alias vazio.");

    const merchant = await this.repository.addAlias(vaultId, merchantId, alias);
    if (!merchant) {
      // Ou o fornecedor não é deste Cofre, ou o alias já pertence a outro. Um
      // alias apontando pra dois fornecedores tornaria a classificação
      // ambígua, e ambiguidade aqui vira gasto na categoria errada.
      const exists = await this.repository.findMerchant(vaultId, merchantId);
      if (!exists) throw new NotFoundError("Fornecedor não encontrado.");
      throw new ConflictError(`O alias "${alias}" já está vinculado a outro fornecedor.`);
    }
    return merchant;
  }

  async removeAlias(vaultId: string, merchantId: string, aliasId: string): Promise<void> {
    const removed = await this.repository.removeAlias(vaultId, merchantId, aliasId);
    if (!removed) throw new NotFoundError("Alias não encontrado.");
  }

  private async assertParentIsRoot(vaultId: string, parentId: string | null): Promise<void> {
    if (!parentId) return;
    const parent = await this.repository.findCategory(vaultId, parentId);
    if (!parent) throw new ValidationError("Categoria mãe não encontrada neste Cofre.");
    if (parent.parentId !== null) {
      throw new ValidationError(
        "Subcategoria não pode ter subcategoria — a árvore tem um nível só.",
      );
    }
  }

  private async assertCategory(vaultId: string, categoryId: string | null): Promise<void> {
    if (!categoryId) return;
    const category = await this.repository.findCategory(vaultId, categoryId);
    if (!category) throw new ValidationError("Categoria não encontrada neste Cofre.");
  }
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
