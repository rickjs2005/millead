import { describe, expect, it } from "vitest";
import { resolveStatementPeriod, resolveStatementStatus } from "./statement-period.js";
import { formatUtcDate, utcDate } from "./vault-date.js";

/** Cartão que fecha dia 10 e vence dia 17 (mesmo mês). */
const card = { closingDay: 10, dueDay: 17 };

function period(date: Date, c = card) {
  const r = resolveStatementPeriod({ purchaseDate: date, ...c });
  return {
    referenceMonth: formatUtcDate(r.referenceMonth),
    closingDate: formatUtcDate(r.closingDate),
    dueDate: formatUtcDate(r.dueDate),
  };
}

describe("resolveStatementPeriod", () => {
  it("compra antes do fechamento cai na fatura do próprio mês", () => {
    expect(period(utcDate(2026, 8, 5))).toEqual({
      referenceMonth: "2026-08-01",
      closingDate: "2026-08-10",
      dueDate: "2026-08-17",
    });
  });

  it("compra no dia do fechamento ainda entra nessa fatura", () => {
    expect(period(utcDate(2026, 8, 10)).closingDate).toBe("2026-08-10");
  });

  it("compra depois do fechamento vai pra fatura seguinte", () => {
    expect(period(utcDate(2026, 8, 11))).toEqual({
      referenceMonth: "2026-09-01",
      closingDate: "2026-09-10",
      dueDate: "2026-09-17",
    });
  });

  it("vira o ano corretamente", () => {
    expect(period(utcDate(2026, 12, 20))).toEqual({
      referenceMonth: "2027-01-01",
      closingDate: "2027-01-10",
      dueDate: "2027-01-17",
    });
  });

  it("vencimento ANTES do fechamento cai no mês seguinte", () => {
    // Cartão que fecha dia 25 e vence dia 5: o vencimento é sempre do mês
    // seguinte ao fechamento, senão a fatura venceria antes de existir.
    const c = { closingDay: 25, dueDay: 5 };
    expect(period(utcDate(2026, 8, 20), c)).toEqual({
      referenceMonth: "2026-08-01",
      closingDate: "2026-08-25",
      dueDate: "2026-09-05",
    });
  });

  it("dia 31 encolhe para o último dia do mês curto", () => {
    const c = { closingDay: 31, dueDay: 31 };
    expect(period(utcDate(2026, 2, 15), c).closingDate).toBe("2026-02-28");
    expect(period(utcDate(2024, 2, 15), c).closingDate).toBe("2024-02-29");
    expect(period(utcDate(2026, 4, 15), c).closingDate).toBe("2026-04-30");
  });

  it("fechamento no fim do mês curto ainda separa as faturas corretamente", () => {
    // Fecha dia 31; em fevereiro isso é 28. Compra em 28/02 entra na fatura de
    // fevereiro; em 01/03, na de março.
    const c = { closingDay: 31, dueDay: 10 };
    expect(period(utcDate(2026, 2, 28), c).referenceMonth).toBe("2026-02-01");
    expect(period(utcDate(2026, 3, 1), c).referenceMonth).toBe("2026-03-01");
  });

  it("recusa dia inválido em vez de chutar uma fatura", () => {
    expect(() =>
      resolveStatementPeriod({ purchaseDate: utcDate(2026, 8, 1), closingDay: 0, dueDay: 10 }),
    ).toThrow();
    expect(() =>
      resolveStatementPeriod({ purchaseDate: utcDate(2026, 8, 1), closingDay: 10, dueDay: 32 }),
    ).toThrow();
  });
});

describe("resolveStatementStatus", () => {
  const base = {
    closingDate: utcDate(2026, 8, 10),
    dueDate: utcDate(2026, 8, 17),
  };

  it("aberta antes do fechamento", () => {
    expect(
      resolveStatementStatus({
        ...base,
        totalCents: 50000,
        paidCents: 0,
        today: utcDate(2026, 8, 5),
      }),
    ).toBe("OPEN");
  });

  it("fechada depois do fechamento e antes do vencimento", () => {
    expect(
      resolveStatementStatus({
        ...base,
        totalCents: 50000,
        paidCents: 0,
        today: utcDate(2026, 8, 12),
      }),
    ).toBe("CLOSED");
  });

  it("parcial quando pagou uma parte", () => {
    expect(
      resolveStatementStatus({
        ...base,
        totalCents: 50000,
        paidCents: 20000,
        today: utcDate(2026, 8, 12),
      }),
    ).toBe("PARTIAL");
  });

  it("paga quando o pagamento cobre o total", () => {
    expect(
      resolveStatementStatus({
        ...base,
        totalCents: 50000,
        paidCents: 50000,
        today: utcDate(2026, 8, 12),
      }),
    ).toBe("PAID");
  });

  it("paga continua paga depois do vencimento — quitado é quitado", () => {
    expect(
      resolveStatementStatus({
        ...base,
        totalCents: 50000,
        paidCents: 50000,
        today: utcDate(2026, 9, 30),
      }),
    ).toBe("PAID");
  });

  it("atrasada quando passou do vencimento sem quitar", () => {
    expect(
      resolveStatementStatus({
        ...base,
        totalCents: 50000,
        paidCents: 20000,
        today: utcDate(2026, 8, 18),
      }),
    ).toBe("OVERDUE");
  });

  it("fatura zerada não vira PAGA por acidente", () => {
    // total 0 e pago 0: `paid >= total` seria verdade e marcaria como quitada
    // uma fatura que nunca teve lançamento nenhum.
    expect(
      resolveStatementStatus({ ...base, totalCents: 0, paidCents: 0, today: utcDate(2026, 8, 5) }),
    ).toBe("OPEN");
  });
});
