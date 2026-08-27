import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, SYSTEM_CATEGORY_KEYS, flattenDefaults } from "./default-categories.js";

describe("DEFAULT_CATEGORIES", () => {
  it("cobre as categorias combinadas, incluindo as subcategorias", () => {
    const nomes = DEFAULT_CATEGORIES.map((c) => c.name);
    expect(nomes).toContain("Alimentação");
    expect(nomes).toContain("Bobeiras");
    expect(nomes).toContain("Trabalho");
    expect(nomes).toContain("Transferências");
    expect(nomes).toContain("Reembolsável");

    const trabalho = DEFAULT_CATEGORIES.find((c) => c.name === "Trabalho");
    expect(trabalho?.children?.map((c) => c.name)).toEqual([
      "IA",
      "Hospedagem",
      "Domínios",
      "Equipamentos",
    ]);
  });

  it("toda chave de sistema é única — é ela que identifica, não o nome", () => {
    const keys = flattenDefaults().map((c) => c.systemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("as chaves com significado de negócio existem na árvore", () => {
    const keys = new Set(flattenDefaults().map((c) => c.systemKey));
    // Sem estas duas, "transferência não é gasto" e "reembolso não é renda"
    // não teriam onde se ancorar depois que o usuário renomear as categorias.
    expect(keys.has(SYSTEM_CATEGORY_KEYS.TRANSFER)).toBe(true);
    expect(keys.has(SYSTEM_CATEGORY_KEYS.REIMBURSABLE)).toBe(true);
    // O exemplo Claude precisa de Trabalho / IA.
    expect(keys.has(SYSTEM_CATEGORY_KEYS.WORK_AI)).toBe(true);
  });

  it("é uma árvore de um nível só — subcategoria não tem filha", () => {
    for (const parent of DEFAULT_CATEGORIES) {
      for (const child of parent.children ?? []) {
        expect(child).not.toHaveProperty("children");
      }
    }
  });
});

describe("flattenDefaults", () => {
  it("devolve pais antes dos filhos, pra inserção respeitar a FK", () => {
    const flat = flattenDefaults();
    for (const [index, item] of flat.entries()) {
      if (!item.parentKey) continue;
      const parentIndex = flat.findIndex((c) => c.systemKey === item.parentKey);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
    }
  });
});
