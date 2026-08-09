import { describe, expect, it } from "vitest";
import {
  contractKpisRanges,
  currentMonthInTimeZone,
  monthRangeSp,
  yearRangeSp,
} from "./contract-kpis-range.js";

describe("currentMonthInTimeZone", () => {
  it("horário UTC de madrugada ainda é o dia anterior em America/Sao_Paulo (UTC-3)", () => {
    expect(currentMonthInTimeZone(new Date("2026-07-01T02:00:00Z"))).toBe("2026-06");
  });

  it("horário UTC do meio-dia já virou o mês em America/Sao_Paulo", () => {
    expect(currentMonthInTimeZone(new Date("2026-07-01T12:00:00Z"))).toBe("2026-07");
  });
});

describe("monthRangeSp", () => {
  it("intervalo [from, to) cobre só o mês pedido, cortado em meia-noite de Brasília (03:00 UTC)", () => {
    const { from, to } = monthRangeSp("2026-02");
    expect(from.toISOString()).toBe("2026-02-01T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-03-01T03:00:00.000Z");
  });

  it("dezembro rola o ano pro `to` corretamente", () => {
    const { from, to } = monthRangeSp("2026-12");
    expect(from.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("yearRangeSp", () => {
  it("intervalo [from, to) cobre o ano inteiro do mês pedido, cortado em meia-noite de Brasília", () => {
    const { from, to } = yearRangeSp("2026-07");
    expect(from.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(to.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("contractKpisRanges", () => {
  it("mês e ano derivam do mesmo `now`, respeitando America/Sao_Paulo", () => {
    // 2026-01-01T02:00:00Z ainda é 2025-12-31 em America/Sao_Paulo -- o
    // recorte de mês E de ano precisam cair em 2025, não em 2026, e o corte
    // em si fica em meia-noite de Brasília (03:00 UTC), não meia-noite UTC.
    const ranges = contractKpisRanges(new Date("2026-01-01T02:00:00Z"));

    expect(ranges.monthFrom.toISOString()).toBe("2025-12-01T03:00:00.000Z");
    expect(ranges.monthTo.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(ranges.yearFrom.toISOString()).toBe("2025-01-01T03:00:00.000Z");
    expect(ranges.yearTo.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("virada de ano em SP: 2026-01-01T02:00:00Z (23h da véspera em Brasília) ainda cai no corte de dezembro/2025, não janeiro/2026", () => {
    // Este é o caso que a bucketização em UTC puro (00:00Z) acertava por
    // coincidência de fuso, mas o corte de RANGE (monthFrom/monthTo) ficava
    // 3h errado -- 2026-01-01T02:00:00Z já é >= monthFrom UTC-puro
    // (2026-01-01T00:00:00Z) mesmo sendo ainda dezembro em Brasília. Com o
    // corte em 03:00 UTC, esse instante fica corretamente FORA do mês de
    // janeiro (janeiro só começa às 2026-01-01T03:00:00Z).
    const now = new Date("2026-01-01T02:00:00Z");
    const ranges = contractKpisRanges(now);

    expect(now.getTime()).toBeLessThan(ranges.monthTo.getTime());
    expect(now.getTime()).toBeGreaterThanOrEqual(ranges.monthFrom.getTime());
  });
});
