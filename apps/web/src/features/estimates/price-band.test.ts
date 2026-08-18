import { describe, expect, it } from "vitest";
import { compararComFaixa } from "./price-band";

const SITE_INSTITUCIONAL = { priceMin: "5000.00", priceMax: "8000.00" };

describe("compararComFaixa", () => {
  it("preço dentro da faixa do catálogo", () => {
    expect(compararComFaixa(5460, SITE_INSTITUCIONAL)).toBe("dentro");
  });

  it("cobrar abaixo do piso é o erro caro -- precisa aparecer", () => {
    expect(compararComFaixa(3200, SITE_INSTITUCIONAL)).toBe("abaixo");
  });

  it("acima do teto não é erro, mas exige justificativa pro cliente", () => {
    expect(compararComFaixa(9000, SITE_INSTITUCIONAL)).toBe("acima");
  });

  it("os limites contam como dentro", () => {
    expect(compararComFaixa(5000, SITE_INSTITUCIONAL)).toBe("dentro");
    expect(compararComFaixa(8000, SITE_INSTITUCIONAL)).toBe("dentro");
  });

  it("sem preço ainda, não opina", () => {
    expect(compararComFaixa(null, SITE_INSTITUCIONAL)).toBeNull();
    expect(compararComFaixa(0, SITE_INSTITUCIONAL)).toBeNull();
  });

  it("sem produto selecionado, não opina", () => {
    expect(compararComFaixa(5460, undefined)).toBeNull();
  });

  it("faixa inválida no cadastro não vira veredito errado", () => {
    expect(compararComFaixa(5460, { priceMin: "0", priceMax: "0" })).toBeNull();
    expect(compararComFaixa(5460, { priceMin: "abc", priceMax: "8000" })).toBeNull();
  });
});
