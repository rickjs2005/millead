import { describe, expect, it } from "vitest";
import {
  addUtcMonths,
  clampDayToMonth,
  formatUtcDate,
  parseUtcDate,
  startOfUtcMonth,
  utcDate,
} from "./vault-date.js";

describe("utcDate", () => {
  it("monta a data em UTC, sem depender do fuso da máquina", () => {
    const d = utcDate(2026, 8, 27);
    expect(d.toISOString()).toBe("2026-08-27T00:00:00.000Z");
  });

  it("não desliza de dia — é o bug clássico do fuso do Brasil", () => {
    // `new Date(2026, 7, 27)` num servidor em UTC-3 vira 27/08 03:00Z; num
    // servidor em UTC+2, vira 26/08 22:00Z e a data "anda" um dia pra trás.
    for (let day = 1; day <= 28; day++) {
      expect(formatUtcDate(utcDate(2026, 2, day))).toBe(`2026-02-${String(day).padStart(2, "0")}`);
    }
  });
});

describe("parseUtcDate", () => {
  it("lê o formato do OFX (AAAAMMDD) e o ISO", () => {
    expect(formatUtcDate(parseUtcDate("20260827")!)).toBe("2026-08-27");
    expect(formatUtcDate(parseUtcDate("2026-08-27")!)).toBe("2026-08-27");
  });

  it("ignora a hora e o fuso que alguns bancos anexam", () => {
    expect(formatUtcDate(parseUtcDate("20260827120000[-3:BRT]")!)).toBe("2026-08-27");
  });

  it("devolve null pro que não é data", () => {
    expect(parseUtcDate("")).toBeNull();
    expect(parseUtcDate("hoje")).toBeNull();
    expect(parseUtcDate("2026-13-01")).toBeNull();
    expect(parseUtcDate("2026-02-30")).toBeNull();
  });
});

describe("clampDayToMonth", () => {
  it("encolhe o dia até o último do mês", () => {
    // Cartão que fecha dia 31 precisa fechar dia 28 em fevereiro.
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    expect(clampDayToMonth(2024, 2, 31)).toBe(29); // bissexto
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
    expect(clampDayToMonth(2026, 1, 31)).toBe(31);
  });
});

describe("addUtcMonths", () => {
  it("avança e retrocede meses", () => {
    expect(formatUtcDate(addUtcMonths(utcDate(2026, 8, 1), 1))).toBe("2026-09-01");
    expect(formatUtcDate(addUtcMonths(utcDate(2026, 12, 1), 1))).toBe("2027-01-01");
    expect(formatUtcDate(addUtcMonths(utcDate(2026, 1, 1), -1))).toBe("2025-12-01");
  });

  it("não transborda o mês quando o dia não existe no destino", () => {
    // 31/01 + 1 mês não pode virar 03/03.
    expect(formatUtcDate(addUtcMonths(utcDate(2026, 1, 31), 1))).toBe("2026-02-28");
  });
});

describe("startOfUtcMonth", () => {
  it("volta pro dia 1", () => {
    expect(formatUtcDate(startOfUtcMonth(utcDate(2026, 8, 27)))).toBe("2026-08-01");
  });
});
