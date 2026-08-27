import { describe, expect, it } from "vitest";
import { categoriesUsedByKeywords, guessCategory } from "./category-keywords.js";

describe("ferramentas de trabalho viram MilWeb", () => {
  it.each([
    ["ANTHROPIC CLAUDE AI SUBSCR", "Trabalho", "IA"],
    ["OPENAI *CHATGPT", "Trabalho", "IA"],
    ["PAG*VERCEL INC", "Trabalho", "Hospedagem"],
    ["MP*SUPABASE", "Trabalho", "Hospedagem"],
    ["REGISTRO.BR ANUIDADE DOMINIO", "Trabalho", "Domínios"],
    ["FIGMA MONTHLY", "Trabalho", "Equipamentos"],
  ])("%s → %s / %s, marcado como MilWeb", (descricao, categoria, sub) => {
    const r = guessCategory(descricao)!;
    expect(r.category).toBe(categoria);
    expect(r.subcategory).toBe(sub);
    expect(r.business).toBe(true);
    expect(r.confidence).toBe("alta");
  });

  it("marketing é MilWeb mesmo sem subcategoria", () => {
    const r = guessCategory("META ADS BR")!;
    expect(r.category).toBe("Trabalho");
    expect(r.business).toBe(true);
  });
});

describe("gasto pessoal continua pessoal", () => {
  it.each([
    ["IFOOD*RESTAURANTE", "Alimentação", "Delivery"],
    ["SUPERMERCADO BOM PRECO", "Alimentação", "Mercado"],
    ["PADARIA CENTRAL", "Alimentação", "Lanches"],
    ["POSTO IPIRANGA", "Transporte", null],
    ["SMARTFIT ACADEMIA", "Academia", null],
    ["DROGARIA PACHECO", "Saúde", null],
    ["NETFLIX.COM", "Assinaturas", null],
  ])("%s → %s", (descricao, categoria, sub) => {
    const r = guessCategory(descricao)!;
    expect(r.category).toBe(categoria);
    expect(r.subcategory).toBe(sub);
    // Nada aqui é da empresa por padrão.
    expect(r.business).toBe(false);
  });
});

describe("ambiguidade vira confiança média, não palpite", () => {
  it("MERCADO sozinho pode ser supermercado ou Mercado Livre", () => {
    expect(guessCategory("MERCADO XYZ")!.confidence).toBe("media");
  });

  it("UBER pode ser corrida ou comida", () => {
    expect(guessCategory("UBER *TRIP")!.confidence).toBe("media");
  });

  it("mas UBER EATS é inequívoco", () => {
    const r = guessCategory("UBER EATS PEDIDO")!;
    expect(r.subcategory).toBe("Delivery");
    expect(r.confidence).toBe("alta");
  });
});

describe("o que não casa não é classificado", () => {
  it("devolve null em vez de mandar tudo pra Outros", () => {
    // "Outros" viraria um balde que ninguém abre, e as linhas que precisam de
    // atenção sumiriam dentro dele.
    expect(guessCategory("ESTABELECIMENTO DESCONHECIDO 4471")).toBeNull();
    expect(guessCategory("")).toBeNull();
    expect(guessCategory("   ")).toBeNull();
  });
});

describe("explicabilidade", () => {
  it("diz qual termo casou — é o que torna a sugestão corrigível", () => {
    // "Foi pra IA porque a descrição contém ANTHROPIC" é auditável.
    expect(guessCategory("ANTHROPIC CLAUDE")!.matched).toBe("ANTHROPIC");
    expect(guessCategory("POSTO SHELL")!.matched).toBe("POSTO");
  });
});

describe("cobertura de categorias", () => {
  it("só produz categorias que existem no Cofre", () => {
    // As 14 raízes que o Cofre cria sozinho (ver default-categories.ts).
    const doCofre = new Set([
      "Alimentação",
      "Bobeiras",
      "Moradia",
      "Contas",
      "Transporte",
      "Saúde",
      "Academia",
      "Lazer",
      "Assinaturas",
      "Educação",
      "Trabalho",
      "Transferências",
      "Reembolsável",
      "Outros",
    ]);
    for (const categoria of categoriesUsedByKeywords()) {
      expect(doCofre, `"${categoria}" não é uma categoria do Cofre`).toContain(categoria);
    }
  });
});
