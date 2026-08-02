import { describe, expect, it } from "vitest";
import { truncateToUtcDay } from "./social-snapshot-day.js";

describe("truncateToUtcDay", () => {
  it("mesma data em horarios diferentes vira o mesmo dia", () => {
    const manha = new Date("2026-03-10T02:15:00.000Z");
    const noite = new Date("2026-03-10T23:59:59.999Z");

    expect(truncateToUtcDay(manha).getTime()).toBe(truncateToUtcDay(noite).getTime());
    expect(truncateToUtcDay(manha).toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("respeita a fronteira de meia-noite UTC (nao vaza pro dia adjacente)", () => {
    const antesDaMeiaNoite = new Date("2026-03-10T23:59:59.999Z");
    const depoisDaMeiaNoite = new Date("2026-03-11T00:00:00.000Z");

    expect(truncateToUtcDay(antesDaMeiaNoite).toISOString()).toBe("2026-03-10T00:00:00.000Z");
    expect(truncateToUtcDay(depoisDaMeiaNoite).toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(truncateToUtcDay(antesDaMeiaNoite).getTime()).not.toBe(
      truncateToUtcDay(depoisDaMeiaNoite).getTime(),
    );
  });

  it("zera horas/minutos/segundos/ms mantendo ano-mes-dia em UTC", () => {
    const data = new Date("2026-12-31T18:42:07.123Z");
    const truncada = truncateToUtcDay(data);

    expect(truncada.getUTCFullYear()).toBe(2026);
    expect(truncada.getUTCMonth()).toBe(11);
    expect(truncada.getUTCDate()).toBe(31);
    expect(truncada.getUTCHours()).toBe(0);
    expect(truncada.getUTCMinutes()).toBe(0);
    expect(truncada.getUTCSeconds()).toBe(0);
    expect(truncada.getUTCMilliseconds()).toBe(0);
  });
});
