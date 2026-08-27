import { describe, expect, it } from "vitest";
import { describeMerchant, titleCase } from "./merchant-display.js";
import { normalizeDescription } from "./transaction-text.js";

describe("serviços reconhecidos", () => {
  it.each([
    ["OPENAI *CHATGPT SUBSCR", "OpenAI / ChatGPT"],
    ["ANTHROPIC CLAUDE AI SUBSCR", "Anthropic / Claude"],
    ["GOOGLE *YOUTUBEPREMIUM", "YouTube"],
    ["IFOOD*RESTAURANTE DO ZE", "iFood"],
    ["PAG*VERCEL INC", "Vercel"],
    ["REGISTRO.BR ANUIDADE", "Registro.br"],
    ["MP*SUPABASE", "Supabase"],
    ["NETFLIX.COM", "Netflix"],
  ])("%s vira %s", (entrada, esperado) => {
    const r = describeMerchant(entrada);
    expect(r.name).toBe(esperado);
    expect(r.merchantHint).toBe(esperado);
    expect(r.confidence).toBe("alta");
  });
});

describe("Pix e TED com nome de pessoa", () => {
  it("extrai o nome e sugere PESSOA, não fornecedor", () => {
    // Pessoa entra em dívidas; fornecedor entra no catálogo. Confundir os dois
    // encheria o catálogo com nomes de gente.
    const r = describeMerchant("PIX RECEBIDO JOAO SILVA");
    expect(r.name).toBe("Joao Silva"); // sem acentuar: o extrato veio sem acento
    expect(r.personHint).toBe(r.name);
    expect(r.merchantHint).toBeNull();
  });

  it("confiança média — nem todo Pix é pessoa", () => {
    // "PIX ENVIADO MERCADO X" casa no mesmo padrão e não é gente.
    expect(describeMerchant("PIX ENVIADO MARIA SOUZA").confidence).toBe("media");
  });

  it("cobre as variações de verbo", () => {
    expect(describeMerchant("TED PARA CARLOS ANDRADE").personHint).toBe("Carlos Andrade");
    expect(describeMerchant("TRANSFERENCIA DE ANA LIMA").personHint).toBe("Ana Lima");
  });
});

describe("limpeza de ruído", () => {
  it("tira prefixo de adquirente, que é de quem processou e não de quem vendeu", () => {
    expect(describeMerchant("PG *PADARIA CENTRAL").name).toBe("Padaria Central");
    expect(describeMerchant("MP*BARBEARIA DO JOAO").name).toBe("Barbearia do Joao");
  });

  it("tira parcela e ruído de cartão da descrição exibida", () => {
    const r = describeMerchant("COMPRA CARTAO LOJA MOVEIS PARC 02/10");
    expect(r.name).toBe("Loja Moveis");
  });

  it("mas a parcela é extraída, não perdida", () => {
    expect(describeMerchant("COMPRA CARTAO LOJA MOVEIS PARC 02/10").installment).toEqual({
      number: 2,
      total: 10,
    });
    expect(describeMerchant("LOJA X 3/12").installment).toEqual({ number: 3, total: 12 });
  });

  it("não reconhecido vira texto legível com confiança BAIXA", () => {
    // Baixa é o que faz a tela pedir revisão em vez de preencher sozinha.
    const r = describeMerchant("ESTABELECIMENTO QUALQUER 998877");
    expect(r.confidence).toBe("baixa");
    expect(r.merchantHint).toBeNull();
    expect(r.name).not.toContain("998877");
  });

  it("descrição vazia não quebra", () => {
    const r = describeMerchant("   ");
    expect(r.name).toBe("Sem descrição");
    expect(r.confidence).toBe("baixa");
  });
});

describe("a descrição original é sagrada", () => {
  it("nada aqui altera `normalizeDescription`", () => {
    // É ela que alimenta o fingerprint de deduplicação. Se mudasse, toda
    // movimentação já importada sem FITID trocaria de chave e uma reimportação
    // inteira pareceria nova.
    const original = "OPENAI *CHATGPT SUBSCR";
    expect(normalizeDescription(original)).toBe("OPENAI *CHATGPT SUBSCR");
    describeMerchant(original);
    expect(normalizeDescription(original)).toBe("OPENAI *CHATGPT SUBSCR");
  });
});

describe("caixa de título", () => {
  it("preposição fica minúscula, sigla curta fica maiúscula", () => {
    expect(titleCase("JOAO DA SILVA")).toBe("Joao da Silva");
    expect(titleCase("LOJA DE ROUPAS LTDA")).toBe("Loja de Roupas LTDA");
  });

  it("não inventa acento", () => {
    // O extrato veio sem acento; adivinhar seria inventar.
    expect(titleCase("JOSE ANTONIO")).toBe("Jose Antonio");
  });
});
