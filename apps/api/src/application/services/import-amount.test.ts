import { describe, expect, it } from "vitest";
import { parseImportedAmount } from "./import-amount.js";

const brl = (raw: string) => parseImportedAmount(raw, ",");
const usd = (raw: string) => parseImportedAmount(raw, ".");

describe("parseImportedAmount — separador vírgula (padrão brasileiro)", () => {
  it("lê valor com milhar e decimal", () => {
    expect(brl("1.234,56")).toEqual({ cents: 123456, negative: false });
    expect(brl("0,01")).toEqual({ cents: 1, negative: false });
  });

  it("lê valor sem decimal", () => {
    expect(brl("1.234")).toEqual({ cents: 123400, negative: false });
    expect(brl("50")).toEqual({ cents: 5000, negative: false });
  });

  it("reconhece negativo em todas as formas que os bancos usam", () => {
    expect(brl("-50,00")).toEqual({ cents: 5000, negative: true });
    expect(brl("50,00-")).toEqual({ cents: 5000, negative: true });
    expect(brl("(50,00)")).toEqual({ cents: 5000, negative: true });
  });

  it("ignora símbolo de moeda e espaço", () => {
    expect(brl("R$ 1.234,56")).toEqual({ cents: 123456, negative: false });
    expect(brl(" 1 234,56 ")).toEqual({ cents: 123456, negative: false });
    expect(brl("+120,00")).toEqual({ cents: 12000, negative: false });
  });
});

describe("parseImportedAmount — separador ponto", () => {
  it("lê valor com milhar por vírgula", () => {
    expect(usd("1,234.56")).toEqual({ cents: 123456, negative: false });
    expect(usd("1234.56")).toEqual({ cents: 123456, negative: false });
  });
});

describe("parseImportedAmount — recusa em vez de chutar", () => {
  it("recusa o que não é número", () => {
    expect(brl("")).toBeNull();
    expect(brl("   ")).toBeNull();
    expect(brl("saldo")).toBeNull();
    expect(brl("R$")).toBeNull();
  });

  it("recusa separador ambíguo em vez de adivinhar", () => {
    // "1,2,3" pode ser qualquer coisa. Importar um palpite aqui vira um valor
    // errado no meio de centenas de linhas certas -- o pior tipo de erro,
    // porque não chama atenção.
    expect(brl("1,2,3")).toBeNull();
  });

  it("recusa mais de duas casas decimais", () => {
    expect(brl("10,005")).toBeNull();
  });

  it("recusa zero — linha de valor zero não é movimentação", () => {
    expect(brl("0,00")).toBeNull();
    expect(brl("0")).toBeNull();
  });
});
