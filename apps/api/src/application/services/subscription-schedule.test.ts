import { describe, expect, it } from "vitest";
import { daysBetween, nextRenewal } from "./subscription-schedule.js";
import { formatUtcDate, utcDate } from "./vault-date.js";

describe("nextRenewal", () => {
  it("mensal avança um mês", () => {
    const next = nextRenewal({ lastChargeAt: utcDate(2026, 8, 5), period: "MONTHLY" });
    expect(formatUtcDate(next)).toBe("2026-09-05");
  });

  it("anual avança um ano", () => {
    const next = nextRenewal({ lastChargeAt: utcDate(2026, 8, 5), period: "YEARLY" });
    expect(formatUtcDate(next)).toBe("2027-08-05");
  });

  it("personalizado avança o número de dias configurado", () => {
    const next = nextRenewal({
      lastChargeAt: utcDate(2026, 8, 5),
      period: "CUSTOM",
      customIntervalDays: 90,
    });
    expect(formatUtcDate(next)).toBe("2026-11-03");
  });

  it("mensal a partir do dia 31 encolhe pro último dia do mês curto", () => {
    // Sem o encolhimento, 31/01 + 1 mês viraria 3 de março e a renovação
    // pularia fevereiro inteiro.
    const next = nextRenewal({ lastChargeAt: utcDate(2026, 1, 31), period: "MONTHLY" });
    expect(formatUtcDate(next)).toBe("2026-02-28");
  });

  it("anual de 29/02 cai em 28/02 no ano não bissexto", () => {
    const next = nextRenewal({ lastChargeAt: utcDate(2024, 2, 29), period: "YEARLY" });
    expect(formatUtcDate(next)).toBe("2025-02-28");
  });

  it("vira o ano corretamente", () => {
    const next = nextRenewal({ lastChargeAt: utcDate(2026, 12, 20), period: "MONTHLY" });
    expect(formatUtcDate(next)).toBe("2027-01-20");
  });

  it("CUSTOM sem intervalo é erro, não um chute", () => {
    expect(() => nextRenewal({ lastChargeAt: utcDate(2026, 8, 5), period: "CUSTOM" })).toThrow();
  });
});

describe("daysBetween", () => {
  it("conta dias inteiros em UTC", () => {
    expect(daysBetween(utcDate(2026, 8, 5), utcDate(2026, 8, 12))).toBe(7);
    expect(daysBetween(utcDate(2026, 8, 5), utcDate(2026, 8, 5))).toBe(0);
  });

  it("é negativo quando a data já passou", () => {
    expect(daysBetween(utcDate(2026, 8, 12), utcDate(2026, 8, 5))).toBe(-7);
  });

  it("atravessa mês e ano sem erro de arredondamento", () => {
    expect(daysBetween(utcDate(2026, 12, 25), utcDate(2027, 1, 1))).toBe(7);
    expect(daysBetween(utcDate(2024, 2, 28), utcDate(2024, 3, 1))).toBe(2); // bissexto
  });
});
