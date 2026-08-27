import { describe, expect, it } from "vitest";
import {
  businessAmount,
  deriveAllocationFlags,
  personalConsumption,
  validateSplits,
} from "./split-allocation.js";

const split = (kind: "PERSONAL" | "REIMBURSABLE" | "BUSINESS", amount: string) => ({
  kind,
  amount,
});

describe("validateSplits", () => {
  it("aceita a divisão do exemplo: R$300 = 100 seu + 100 a receber + 100 da MilWeb", () => {
    const result = validateSplits("300.00", [
      split("PERSONAL", "100.00"),
      split("REIMBURSABLE", "100.00"),
      split("BUSINESS", "100.00"),
    ]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.personalRemainder).toBe("0.00");
  });

  it("aceita divisão parcial — o resto continua sendo pessoal", () => {
    const result = validateSplits("300.00", [split("BUSINESS", "120.00")]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.personalRemainder).toBe("180.00");
  });

  it("recusa soma acima do valor da transação", () => {
    const result = validateSplits("300.00", [
      split("BUSINESS", "200.00"),
      split("REIMBURSABLE", "150.00"),
    ]);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/soma/i);
  });

  it("recusa por um centavo — é dinheiro, não aproximação", () => {
    expect(validateSplits("300.00", [split("BUSINESS", "300.01")]).ok).toBe(false);
    expect(validateSplits("300.00", [split("BUSINESS", "300.00")]).ok).toBe(true);
  });

  it("recusa valor zero ou negativo", () => {
    expect(validateSplits("300.00", [split("BUSINESS", "0.00")]).ok).toBe(false);
    expect(validateSplits("300.00", [split("BUSINESS", "-10.00")]).ok).toBe(false);
  });

  it("sem divisão nenhuma é válido: 100% pessoal", () => {
    const result = validateSplits("300.00", []);
    expect(result.ok).toBe(true);
    expect(result.ok && result.personalRemainder).toBe("300.00");
  });

  it("soma centavos sem erro de ponto flutuante", () => {
    const result = validateSplits("0.30", [split("BUSINESS", "0.10"), split("PERSONAL", "0.20")]);
    expect(result.ok).toBe(true);
    expect(result.ok && result.personalRemainder).toBe("0.00");
  });
});

describe("deriveAllocationFlags", () => {
  it("os indicadores são DERIVADOS das divisões, não guardados", () => {
    expect(deriveAllocationFlags([])).toEqual({ isBusiness: false, isReimbursable: false });
    expect(deriveAllocationFlags([split("BUSINESS", "10.00")])).toEqual({
      isBusiness: true,
      isReimbursable: false,
    });
    expect(
      deriveAllocationFlags([split("BUSINESS", "10.00"), split("REIMBURSABLE", "5.00")]),
    ).toEqual({ isBusiness: true, isReimbursable: true });
  });
});

describe("consumo pessoal x empresarial", () => {
  it("gasto da MilWeb pago no cartão pessoal sai do consumo pessoal", () => {
    // Exigência do exemplo Claude: os R$120 continuam sendo saída de caixa,
    // mas não são consumo pessoal.
    const splits = [split("BUSINESS", "120.00")];
    expect(personalConsumption("120.00", splits)).toBe("0.00");
    expect(businessAmount(splits)).toBe("120.00");
  });

  it("compra reembolsável também não é consumo pessoal", () => {
    expect(personalConsumption("300.00", [split("REIMBURSABLE", "100.00")])).toBe("200.00");
  });

  it("divisão PERSONAL explícita continua contando como consumo", () => {
    expect(personalConsumption("300.00", [split("PERSONAL", "300.00")])).toBe("300.00");
  });

  it("sem divisões, tudo é consumo pessoal", () => {
    expect(personalConsumption("300.00", [])).toBe("300.00");
  });

  it("transferência não chega aqui — quem filtra é o chamador", () => {
    // Documenta a fronteira: `personalConsumption` não conhece `isTransfer`.
    // Somar transferência como consumo é responsabilidade de quem monta o
    // relatório, e é exatamente onde o teste de regressão vai morar.
    expect(personalConsumption("500.00", [])).toBe("500.00");
  });
});
