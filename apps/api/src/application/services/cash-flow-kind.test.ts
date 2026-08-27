import { describe, expect, it } from "vitest";
import { classifyCashFlow, countsAsExpense, countsAsIncome } from "./cash-flow-kind.js";

const entrada = { direction: "IN" as const, isTransfer: false, settlesDebtId: null };
const saida = { direction: "OUT" as const, isTransfer: false, settlesDebtId: null };

describe("classifyCashFlow", () => {
  it("entrada comum é receita", () => {
    expect(classifyCashFlow(entrada)).toBe("INCOME");
    expect(countsAsIncome(entrada)).toBe(true);
  });

  it("saída comum é despesa", () => {
    expect(classifyCashFlow(saida)).toBe("EXPENSE");
    expect(countsAsExpense(saida)).toBe(true);
  });

  it("o Pix que quita uma dívida NÃO é renda", () => {
    const pix = { ...entrada, settlesDebtId: "debt-1" };
    expect(classifyCashFlow(pix)).toBe("DEBT_SETTLEMENT");
    expect(countsAsIncome(pix)).toBe(false);
    expect(countsAsExpense(pix)).toBe(false);
  });

  it("pagar uma dívida minha NÃO é despesa nova", () => {
    const pagamento = { ...saida, settlesDebtId: "debt-2" };
    expect(classifyCashFlow(pagamento)).toBe("DEBT_SETTLEMENT");
    expect(countsAsExpense(pagamento)).toBe(false);
    expect(countsAsIncome(pagamento)).toBe(false);
  });

  it("transferência continua fora dos dois totais", () => {
    expect(classifyCashFlow({ ...entrada, isTransfer: true })).toBe("TRANSFER");
    expect(classifyCashFlow({ ...saida, isTransfer: true })).toBe("TRANSFER");
  });

  it("baixa vence transferência quando as duas marcas aparecem", () => {
    // O serviço impede a combinação; o teste fixa o que acontece se ela vazar
    // por outro caminho, pra que a resposta nunca dependa da ordem dos ifs.
    expect(classifyCashFlow({ ...entrada, isTransfer: true, settlesDebtId: "d" })).toBe(
      "DEBT_SETTLEMENT",
    );
  });
});
