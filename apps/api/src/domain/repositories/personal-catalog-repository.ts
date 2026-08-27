import type {
  PersonalCategory,
  PersonalMerchant,
  PersonalMerchantWithAliases,
} from "../entities/personal-finance.js";

/**
 * Catálogo do Cofre: categorias (com um nível de subcategoria) e fornecedores
 * normalizados com seus aliases bancários.
 *
 * Os dois andam juntos porque um fornecedor aponta pra uma categoria padrão, e
 * a classificação (fase 4) sempre resolve os dois na mesma passada.
 */

export interface CreateCategoryInput {
  name: string;
  parentId: string | null;
  color: string | null;
}

export type UpdateCategoryInput = Partial<CreateCategoryInput> & {
  isActive?: boolean;
  sortOrder?: number;
};

/** Uma linha da árvore padrão, já achatada com o pai antes das filhas. */
export interface SeedCategoryItem {
  systemKey: string;
  name: string;
  parentKey: string | null;
  sortOrder: number;
}

export interface CreateMerchantInput {
  name: string;
  defaultCategoryId: string | null;
  /** Aliases já normalizados. */
  aliases: string[];
}

export type UpdateMerchantInput = Partial<Omit<CreateMerchantInput, "aliases">> & {
  isActive?: boolean;
};

export interface PersonalCatalogRepository {
  // ----- Categorias -----
  listCategories(vaultId: string, includeInactive: boolean): Promise<PersonalCategory[]>;
  findCategory(vaultId: string, id: string): Promise<PersonalCategory | null>;
  findCategoryBySystemKey(vaultId: string, systemKey: string): Promise<PersonalCategory | null>;
  createCategory(vaultId: string, input: CreateCategoryInput): Promise<PersonalCategory>;
  updateCategory(
    vaultId: string,
    id: string,
    patch: UpdateCategoryInput,
  ): Promise<PersonalCategory | null>;
  /** `false` se a categoria tem subcategorias, movimentações ou divisões
   *  apontando pra ela. Desativar é o caminho para parar de usar sem perder o
   *  passado — uma categoria apagada deixaria lançamentos antigos sem
   *  classificação e mudaria relatórios já fechados. */
  deleteCategory(vaultId: string, id: string): Promise<boolean>;
  /** Quantas movimentações/divisões usam a categoria (a tela avisa antes de
   *  desativar). */
  countCategoryUsage(vaultId: string, id: string): Promise<number>;

  /** Cria a árvore padrão do Cofre. Idempotente pelo unique
   *  `(vaultId, systemKey)` -- chamar de novo não duplica nem desfaz o que
   *  você renomeou. Recebe a lista pronta em vez de conhecer o catálogo:
   *  a taxonomia é decisão de aplicação, não de persistência. */
  seedCategories(vaultId: string, items: readonly SeedCategoryItem[]): Promise<void>;

  // ----- Fornecedores -----
  listMerchants(vaultId: string, includeInactive: boolean): Promise<PersonalMerchantWithAliases[]>;
  findMerchant(vaultId: string, id: string): Promise<PersonalMerchantWithAliases | null>;
  createMerchant(vaultId: string, input: CreateMerchantInput): Promise<PersonalMerchant>;
  updateMerchant(
    vaultId: string,
    id: string,
    patch: UpdateMerchantInput,
  ): Promise<PersonalMerchant | null>;
  deleteMerchant(vaultId: string, id: string): Promise<boolean>;

  /** `null` quando o alias já pertence a outro fornecedor — quem decide é o
   *  unique do banco, não uma leitura anterior. */
  addAlias(vaultId: string, merchantId: string, alias: string): Promise<PersonalMerchant | null>;
  removeAlias(vaultId: string, merchantId: string, aliasId: string): Promise<boolean>;
  /** Resolve o fornecedor a partir de um alias exato já normalizado. É a
   *  consulta que a classificação da fase 4 vai usar. */
  findMerchantByAlias(vaultId: string, alias: string): Promise<PersonalMerchant | null>;
}
