/**
 * Árvore de categorias criada junto com o Cofre.
 *
 * São um ponto de partida, não uma regra: tudo pode ser renomeado,
 * reorganizado ou desativado. Por isso cada categoria carrega uma
 * `systemKey` — o **nome não serve de identificador**. Se a regra
 * "transferência não é gasto" procurasse pela categoria chamada
 * "Transferências", ela pararia de funcionar no dia em que você renomeasse
 * pra "Movimentação interna", e o erro apareceria como um total de gastos
 * inflado, sem nada quebrado à vista.
 *
 * Categorias que você criar do zero têm `systemKey` nula — nenhuma lógica
 * depende delas.
 */

/** As chaves com significado de negócio no resto do módulo. */
export const SYSTEM_CATEGORY_KEYS = {
  /** Transferência entre contas próprias e pagamento de fatura. */
  TRANSFER: "transfer",
  /** Compra feita para outra pessoa, que volta como valor a receber. */
  REIMBURSABLE: "reimbursable",
  /** Trabalho / IA — destino das assinaturas de IA no exemplo do Claude. */
  WORK_AI: "work.ai",
  OTHER: "other",
} as const;

export interface DefaultCategoryChild {
  systemKey: string;
  name: string;
}

export interface DefaultCategory extends DefaultCategoryChild {
  children?: DefaultCategoryChild[];
}

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  {
    systemKey: "food",
    name: "Alimentação",
    children: [
      { systemKey: "food.market", name: "Mercado" },
      { systemKey: "food.restaurant", name: "Restaurante" },
      { systemKey: "food.snacks", name: "Lanches" },
      { systemKey: "food.delivery", name: "Delivery" },
    ],
  },
  {
    systemKey: "impulse",
    name: "Bobeiras",
    children: [
      { systemKey: "impulse.buy", name: "Compras por impulso" },
      { systemKey: "impulse.games", name: "Jogos" },
      { systemKey: "impulse.online", name: "Compras online" },
    ],
  },
  { systemKey: "housing", name: "Moradia" },
  { systemKey: "bills", name: "Contas" },
  { systemKey: "transport", name: "Transporte" },
  { systemKey: "health", name: "Saúde" },
  { systemKey: "gym", name: "Academia" },
  { systemKey: "leisure", name: "Lazer" },
  { systemKey: "subscriptions", name: "Assinaturas" },
  { systemKey: "education", name: "Educação" },
  {
    systemKey: "work",
    name: "Trabalho",
    children: [
      { systemKey: SYSTEM_CATEGORY_KEYS.WORK_AI, name: "IA" },
      { systemKey: "work.hosting", name: "Hospedagem" },
      { systemKey: "work.domains", name: "Domínios" },
      { systemKey: "work.equipment", name: "Equipamentos" },
    ],
  },
  { systemKey: SYSTEM_CATEGORY_KEYS.TRANSFER, name: "Transferências" },
  { systemKey: SYSTEM_CATEGORY_KEYS.REIMBURSABLE, name: "Reembolsável" },
  { systemKey: SYSTEM_CATEGORY_KEYS.OTHER, name: "Outros" },
];

export interface FlatDefaultCategory {
  systemKey: string;
  name: string;
  parentKey: string | null;
  sortOrder: number;
}

/**
 * Achata a árvore com os pais SEMPRE antes dos filhos — a inserção segue esta
 * ordem, e uma subcategoria criada antes da mãe violaria a FK.
 */
export function flattenDefaults(): FlatDefaultCategory[] {
  const flat: FlatDefaultCategory[] = [];
  for (const [index, parent] of DEFAULT_CATEGORIES.entries()) {
    flat.push({
      systemKey: parent.systemKey,
      name: parent.name,
      parentKey: null,
      sortOrder: index,
    });
    for (const [childIndex, child] of (parent.children ?? []).entries()) {
      flat.push({
        systemKey: child.systemKey,
        name: child.name,
        parentKey: parent.systemKey,
        sortOrder: childIndex,
      });
    }
  }
  return flat;
}
