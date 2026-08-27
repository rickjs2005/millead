import { describe, expect, it } from "vitest";
import { debtBalance, debtOverpayment, resolveDebtStatus, validatePayment } from "./debt-status.js";
import { utcDate } from "./vault-date.js";

const HOJE = utcDate(2026, 8, 27);

function estado(over: Partial<Parameters<typeof resolveDebtStatus>[0]> = {}) {
  return resolveDebtStatus({
    originalCents: 50000,
    paidCents: 0,
    dueDate: null,
    today: HOJE,
    canceledAt: null,
    ...over,
  });
}

describe("resolveDebtStatus", () => {
  it("nasce em aberto", () => {
    expect(estado()).toBe("OPEN");
  });

  it("vira parcial com uma devolução menor que o total", () => {
    expect(estado({ paidCents: 20000 })).toBe("PARTIAL");
  });

  it("vira quitada quando as devoluções alcançam o valor", () => {
    expect(estado({ paidCents: 50000 })).toBe("PAID");
  });

  it("atrasa sozinha quando o vencimento passa — ninguém escreve nada", () => {
    expect(estado({ dueDate: utcDate(2026, 8, 26) })).toBe("OVERDUE");
    // É esta propriedade que justifica não ter coluna de status: entre ontem e
    // hoje nada foi gravado, e mesmo assim a resposta muda.
    expect(
      resolveDebtStatus({
        originalCents: 50000,
        paidCents: 0,
        dueDate: utcDate(2026, 8, 26),
        today: utcDate(2026, 8, 26),
        canceledAt: null,
      }),
    ).toBe("OPEN");
  });

  it("dívida sem prazo nunca atrasa", () => {
    expect(estado({ dueDate: null })).toBe("OPEN");
  });

  it("parcial e vencida é ATRASADA — o que falta importa mais que o que veio", () => {
    expect(estado({ paidCents: 20000, dueDate: utcDate(2026, 8, 1) })).toBe("OVERDUE");
  });

  it("pagou fora do prazo continua sendo pagou", () => {
    expect(estado({ paidCents: 50000, dueDate: utcDate(2026, 8, 1) })).toBe("PAID");
  });

  it("cancelada vence tudo, inclusive vencimento passado", () => {
    expect(estado({ paidCents: 10000, dueDate: utcDate(2026, 1, 1), canceledAt: new Date() })).toBe(
      "CANCELED",
    );
  });
});

describe("saldo", () => {
  it("é o que falta", () => {
    expect(debtBalance(50000, 20000)).toBe(30000);
  });

  it("nunca fica negativo: devolver a mais não cria dívida na direção oposta", () => {
    expect(debtBalance(50000, 60000)).toBe(0);
    expect(debtOverpayment(50000, 60000)).toBe(10000);
  });

  it("sem excedente quando a conta fecha exata", () => {
    expect(debtOverpayment(50000, 50000)).toBe(0);
  });
});

describe("validatePayment", () => {
  it("aceita baixa que cabe no saldo", () => {
    expect(validatePayment(50000, 20000, 30000)).toEqual({ ok: true });
  });

  it("recusa baixa maior que o saldo, dizendo quanto cabe", () => {
    const r = validatePayment(50000, 20000, 30001);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("R$ 300,00");
  });

  it("recusa um centavo a mais — em dinheiro, quase igual é errado", () => {
    expect(validatePayment(10000, 0, 10001).ok).toBe(false);
    expect(validatePayment(10000, 0, 10000).ok).toBe(true);
  });

  it("recusa baixa em dívida já quitada", () => {
    const r = validatePayment(50000, 50000, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("já está quitada");
  });

  it("recusa valor zero ou negativo", () => {
    expect(validatePayment(50000, 0, 0).ok).toBe(false);
    expect(validatePayment(50000, 0, -100).ok).toBe(false);
  });
});
