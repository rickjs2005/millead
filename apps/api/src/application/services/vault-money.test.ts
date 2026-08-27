import { describe, expect, it } from "vitest";
import {
  addMoney,
  compareMoney,
  formatMoney,
  parseMoney,
  percentOfMoney,
  subtractMoney,
  sumMoney,
} from "./vault-money.js";

describe("parseMoney", () => {
  it("converte para centavos inteiros", () => {
    expect(parseMoney("120.00")).toBe(12000);
    expect(parseMoney("0.01")).toBe(1);
    expect(parseMoney("1234567.89")).toBe(123456789);
  });

  it("aceita valor sem casas decimais", () => {
    expect(parseMoney("120")).toBe(12000);
    expect(parseMoney("120.5")).toBe(12050);
  });

  it("recusa o que não é dinheiro", () => {
    expect(() => parseMoney("abc")).toThrow();
    expect(() => parseMoney("")).toThrow();
    // Mais de duas casas é erro, não arredondamento: arredondar em silêncio
    // faz um total fechar por sorte e o outro não.
    expect(() => parseMoney("1.005")).toThrow();
  });
});

describe("aritmética em centavos", () => {
  it("soma sem erro de ponto flutuante", () => {
    // 0.1 + 0.2 !== 0.3 em float. Em centavos é exato.
    expect(formatMoney(addMoney("0.10", "0.20"))).toBe("0.30");
  });

  it("soma uma lista", () => {
    expect(formatMoney(sumMoney(["100.00", "100.00", "100.00"]))).toBe("300.00");
    expect(formatMoney(sumMoney([]))).toBe("0.00");
  });

  it("subtrai", () => {
    expect(formatMoney(subtractMoney("300.00", "199.99"))).toBe("100.01");
  });

  it("compara", () => {
    expect(compareMoney("100.00", "100.00")).toBe(0);
    expect(compareMoney("100.01", "100.00")).toBe(1);
    expect(compareMoney("99.99", "100.00")).toBe(-1);
  });
});

describe("formatMoney", () => {
  it("sempre devolve duas casas", () => {
    expect(formatMoney(0)).toBe("0.00");
    expect(formatMoney(5)).toBe("0.05");
    expect(formatMoney(50)).toBe("0.50");
    expect(formatMoney(12000)).toBe("120.00");
  });

  it("preserva o sinal negativo", () => {
    expect(formatMoney(-1)).toBe("-0.01");
    expect(formatMoney(-12050)).toBe("-120.50");
  });
});

describe("percentOfMoney", () => {
  it("100% é o valor inteiro", () => {
    expect(formatMoney(percentOfMoney(parseMoney("120.00"), "100"))).toBe("120.00");
  });

  it("percentual fracionado arredonda meio-pra-cima", () => {
    expect(formatMoney(percentOfMoney(parseMoney("100.00"), "33.33"))).toBe("33.33");
    expect(formatMoney(percentOfMoney(parseMoney("100.00"), "0.005"))).toBe("0.01");
  });

  it("0% é zero", () => {
    expect(percentOfMoney(parseMoney("120.00"), "0")).toBe(0);
  });

  it("recusa percentual fora de 0..100", () => {
    expect(() => percentOfMoney(1000, "-1")).toThrow();
    expect(() => percentOfMoney(1000, "101")).toThrow();
    expect(() => percentOfMoney(1000, "abc")).toThrow();
  });
});
