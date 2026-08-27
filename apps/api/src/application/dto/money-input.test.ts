import { describe, expect, it } from "vitest";
import { moneyInput, normalizeMoneyInput, positiveMoneyInput } from "./money-input.js";

describe("dinheiro digitado em português", () => {
  it("aceita vírgula como separador decimal", () => {
    // O caso que quebrou de verdade: campo "Saldo hoje", pessoa digita 8,06.
    expect(normalizeMoneyInput("8,06")).toBe("8.06");
    expect(normalizeMoneyInput("1234,56")).toBe("1234.56");
    expect(normalizeMoneyInput("0,01")).toBe("0.01");
  });

  it("continua aceitando ponto — era o formato de antes", () => {
    expect(normalizeMoneyInput("8.06")).toBe("8.06");
    expect(normalizeMoneyInput("1234.56")).toBe("1234.56");
    expect(normalizeMoneyInput("300")).toBe("300");
  });

  it("com os dois separadores, o último é o decimal", () => {
    expect(normalizeMoneyInput("1.234,56")).toBe("1234.56"); // brasileiro
    expect(normalizeMoneyInput("1,234.56")).toBe("1234.56"); // americano
    expect(normalizeMoneyInput("1.234.567,89")).toBe("1234567.89");
  });

  it("tira R$ e espaços — quem copia do extrato cola com eles", () => {
    expect(normalizeMoneyInput("R$ 1.234,56")).toBe("1234.56");
    expect(normalizeMoneyInput("R$8,06")).toBe("8.06");
    expect(normalizeMoneyInput(" 300,00 ")).toBe("300.00");
    // Espaço não separável, que vem colado ao copiar de página de banco.
    expect(normalizeMoneyInput("R$ 1.234,56")).toBe("1234.56");
  });

  it("recusa negativo — o sinal mora na direção da movimentação", () => {
    expect(normalizeMoneyInput("-8,06")).toBeNull();
    expect(normalizeMoneyInput("-300")).toBeNull();
  });

  it("recusa mais de duas casas — arredondar em silêncio seria pior", () => {
    expect(normalizeMoneyInput("8,061")).toBeNull();
    expect(normalizeMoneyInput("8.061")).toBeNull();
  });

  it("recusa lixo em vez de adivinhar", () => {
    expect(normalizeMoneyInput("")).toBeNull();
    expect(normalizeMoneyInput("abc")).toBeNull();
    expect(normalizeMoneyInput("8,0,6")).toBeNull();
    expect(normalizeMoneyInput("8..06")).toBeNull();
    expect(normalizeMoneyInput("R$")).toBeNull();
  });
});

describe("schema", () => {
  it("normaliza no parse, então o resto do sistema só vê ponto", () => {
    expect(moneyInput.parse("8,06")).toBe("8.06");
    expect(moneyInput.parse("R$ 1.234,56")).toBe("1234.56");
  });

  it("a mensagem de erro mostra os dois formatos que funcionam", () => {
    const r = moneyInput.safeParse("oito reais");
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.message).toContain("1234,56");
      expect(r.error.issues[0]!.message).toContain("1234.56");
    }
  });

  it("a variante positiva recusa zero", () => {
    const schema = positiveMoneyInput();
    expect(schema.safeParse("0,00").success).toBe(false);
    expect(schema.safeParse("0").success).toBe(false);
    expect(schema.parse("0,01")).toBe("0.01");
  });
});
