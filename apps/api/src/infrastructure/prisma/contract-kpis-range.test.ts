import { describe, expect, it } from "vitest";
import {
  contractKpisRanges,
  currentMonthInTimeZone,
  monthRangeUtc,
  yearRangeUtc,
} from "./contract-kpis-range.js";

describe("currentMonthInTimeZone", () => {
  it("horário UTC de madrugada ainda é o dia anterior em America/Sao_Paulo (UTC-3)", () => {
    expect(currentMonthInTimeZone(new Date("2026-07-01T02:00:00Z"))).toBe("2026-06");
  });

  it("horário UTC do meio-dia já virou o mês em America/Sao_Paulo", () => {
    expect(currentMonthInTimeZone(new Date("2026-07-01T12:00:00Z"))).toBe("2026-07");
  });
});

describe("monthRangeUtc", () => {
  it("intervalo [from, to) cobre só o mês pedido, em UTC", () => {
    const { from, to } = monthRangeUtc("2026-02");
    expect(from.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("dezembro rola o ano pro `to` corretamente", () => {
    const { from, to } = monthRangeUtc("2026-12");
    expect(from.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("yearRangeUtc", () => {
  it("intervalo [from, to) cobre o ano inteiro do mês pedido, em UTC", () => {
    const { from, to } = yearRangeUtc("2026-07");
    expect(from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("contractKpisRanges", () => {
  it("mês e ano derivam do mesmo `now`, respeitando America/Sao_Paulo", () => {
    // 2026-01-01T02:00:00Z ainda é 2025-12-31 em America/Sao_Paulo -- o
    // recorte de mês E de ano precisam cair em 2025, não em 2026.
    const ranges = contractKpisRanges(new Date("2026-01-01T02:00:00Z"));

    expect(ranges.monthFrom.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(ranges.monthTo.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(ranges.yearFrom.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(ranges.yearTo.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });
});
