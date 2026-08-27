import { describe, expect, it } from "vitest";
import { buildFingerprint } from "./transaction-fingerprint.js";
import { utcDate } from "./vault-date.js";

const base = {
  sourceId: "acc-1",
  transactionDate: utcDate(2026, 8, 27),
  amountBrl: "120.00",
  direction: "OUT" as const,
  normalizedDescription: "ANTHROPIC CLAUDE",
};

describe("buildFingerprint", () => {
  it("é determinístico — a mesma linha gera sempre a mesma chave", () => {
    expect(buildFingerprint(base)).toBe(buildFingerprint({ ...base }));
  });

  it("usa o FITID quando o banco manda um", () => {
    const comFitid = buildFingerprint({ ...base, externalId: "202608270001" });
    expect(comFitid).toContain("fitid:");
    expect(comFitid).not.toBe(buildFingerprint(base));
  });

  it("o FITID vence a descrição: banco que reescreve o texto não duplica", () => {
    // Alguns bancos mudam a descrição da mesma transação entre um extrato e
    // outro. Se a chave dependesse do texto, a reimportação criaria uma linha
    // nova. Com FITID, continua sendo a mesma.
    const a = buildFingerprint({ ...base, externalId: "X1" });
    const b = buildFingerprint({
      ...base,
      externalId: "X1",
      normalizedDescription: "ANTHROPIC CLAUDE PRO MENSAL",
      amountBrl: "121.00",
    });
    expect(a).toBe(b);
  });

  it("o mesmo FITID em contas diferentes não colide", () => {
    // FITID é único dentro da conta, não no mundo.
    const a = buildFingerprint({ ...base, externalId: "1" });
    const b = buildFingerprint({ ...base, sourceId: "acc-2", externalId: "1" });
    expect(a).not.toBe(b);
  });

  it("sem FITID, qualquer campo diferente muda a chave", () => {
    const original = buildFingerprint(base);
    expect(buildFingerprint({ ...base, amountBrl: "120.01" })).not.toBe(original);
    expect(buildFingerprint({ ...base, direction: "IN" })).not.toBe(original);
    expect(buildFingerprint({ ...base, transactionDate: utcDate(2026, 8, 28) })).not.toBe(original);
    expect(buildFingerprint({ ...base, normalizedDescription: "OUTRA COISA" })).not.toBe(original);
    expect(buildFingerprint({ ...base, sourceId: "acc-2" })).not.toBe(original);
  });

  it("cabe numa coluna de texto indexável", () => {
    expect(buildFingerprint(base).length).toBeLessThanOrEqual(120);
  });
});
