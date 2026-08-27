import { describe, expect, it } from "vitest";
import { detectRecurrence } from "./subscription-detection.js";
import { utcDate } from "./vault-date.js";

const charge = (year: number, month: number, day: number, cents: number) => ({
  date: utcDate(year, month, day),
  amountCents: cents,
});

describe("uma cobrança só nunca vira assinatura", () => {
  it("recusa com uma ocorrência", () => {
    // Exigência explícita: uma cobrança é uma compra; assinatura precisa de
    // repetição pra ser afirmada.
    expect(detectRecurrence([charge(2026, 8, 5, 12000)])).toBeNull();
  });

  it("recusa com lista vazia", () => {
    expect(detectRecurrence([])).toBeNull();
  });
});

describe("mensal", () => {
  it("duas cobranças a ~30 dias viram sugestão mensal", () => {
    const result = detectRecurrence([charge(2026, 7, 5, 12000), charge(2026, 8, 5, 12000)]);
    expect(result).toMatchObject({ period: "MONTHLY", occurrences: 2, expectedCents: 12000 });
  });

  it("aceita a variação natural de dia entre meses", () => {
    // Cobranças em 31/01, 28/02 e 31/03: os intervalos são 28 e 31 dias, e as
    // três são a mesma assinatura mensal.
    const result = detectRecurrence([
      charge(2026, 1, 31, 5000),
      charge(2026, 2, 28, 5000),
      charge(2026, 3, 31, 5000),
    ]);
    expect(result?.period).toBe("MONTHLY");
  });

  it("usa a cobrança MAIS RECENTE como valor esperado", () => {
    // O preço de hoje é o que vai ser cobrado de novo — a média puxaria o
    // esperado pra baixo e geraria alerta de variação na próxima cobrança.
    const result = detectRecurrence([charge(2026, 7, 5, 10000), charge(2026, 8, 5, 12000)], {
      amountTolerancePct: 30,
    });
    expect(result?.expectedCents).toBe(12000);
  });

  it("aceita a lista fora de ordem", () => {
    const result = detectRecurrence([charge(2026, 8, 5, 12000), charge(2026, 7, 5, 12000)]);
    expect(result?.period).toBe("MONTHLY");
  });
});

describe("anual", () => {
  it("duas cobranças a ~365 dias viram sugestão anual", () => {
    const result = detectRecurrence([charge(2025, 8, 5, 60000), charge(2026, 8, 5, 60000)]);
    expect(result).toMatchObject({ period: "YEARLY", occurrences: 2 });
  });

  it("tolera alguns dias de diferença na data da renovação", () => {
    const result = detectRecurrence([charge(2025, 8, 5, 60000), charge(2026, 8, 12, 60000)]);
    expect(result?.period).toBe("YEARLY");
  });
});

describe("personalizado", () => {
  it("intervalo consistente que não é mensal nem anual vira CUSTOM", () => {
    // Trimestral: ~91 dias.
    const result = detectRecurrence([
      charge(2026, 1, 5, 30000),
      charge(2026, 4, 5, 30000),
      charge(2026, 7, 5, 30000),
    ]);
    expect(result).toMatchObject({ period: "CUSTOM" });
    expect(result!.intervalDays).toBeGreaterThan(85);
    expect(result!.intervalDays).toBeLessThan(95);
  });
});

describe("o que NÃO é assinatura", () => {
  it("intervalos irregulares não viram nada", () => {
    // Compras avulsas no mesmo lugar: 3 dias, depois 40.
    expect(
      detectRecurrence([
        charge(2026, 8, 1, 5000),
        charge(2026, 8, 4, 5000),
        charge(2026, 9, 13, 5000),
      ]),
    ).toBeNull();
  });

  it("valores muito diferentes não viram assinatura", () => {
    // Mesmo fornecedor, mesma cadência, valores que não se parecem: é compra
    // recorrente, não assinatura de valor fixo.
    expect(detectRecurrence([charge(2026, 7, 5, 2000), charge(2026, 8, 5, 90000)])).toBeNull();
  });

  it("respeita a tolerância configurada", () => {
    const cobrancas = [charge(2026, 7, 5, 10000), charge(2026, 8, 5, 11500)];
    expect(detectRecurrence(cobrancas, { amountTolerancePct: 5 })).toBeNull();
    expect(detectRecurrence(cobrancas, { amountTolerancePct: 20 })?.period).toBe("MONTHLY");
  });

  it("duas cobranças no mesmo dia não são recorrência", () => {
    expect(detectRecurrence([charge(2026, 8, 5, 12000), charge(2026, 8, 5, 12000)])).toBeNull();
  });
});
