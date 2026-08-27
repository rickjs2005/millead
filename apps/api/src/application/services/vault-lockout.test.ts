import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS_BEFORE_LOCK,
  attemptsRemaining,
  isLocked,
  lockoutFor,
} from "./vault-lockout.js";

const NOW = new Date("2026-08-27T12:00:00.000Z");
const minutesAfter = (n: number) => new Date(NOW.getTime() + n * 60_000);

describe("lockoutFor", () => {
  it("não bloqueia enquanto houver tentativas no orçamento", () => {
    for (let attempts = 0; attempts < MAX_ATTEMPTS_BEFORE_LOCK; attempts++) {
      expect(lockoutFor(attempts, NOW)).toBeNull();
    }
  });

  it("bloqueia na falha que atinge o limite", () => {
    expect(lockoutFor(MAX_ATTEMPTS_BEFORE_LOCK, NOW)).toEqual(minutesAfter(1));
  });

  it("escala o bloqueio a cada nova falha depois do limite", () => {
    expect(lockoutFor(MAX_ATTEMPTS_BEFORE_LOCK + 1, NOW)).toEqual(minutesAfter(5));
    expect(lockoutFor(MAX_ATTEMPTS_BEFORE_LOCK + 2, NOW)).toEqual(minutesAfter(15));
    expect(lockoutFor(MAX_ATTEMPTS_BEFORE_LOCK + 3, NOW)).toEqual(minutesAfter(60));
  });

  it("satura no maior degrau -- nunca volta a bloquear por menos tempo", () => {
    expect(lockoutFor(MAX_ATTEMPTS_BEFORE_LOCK + 50, NOW)).toEqual(minutesAfter(60));
  });
});

describe("isLocked", () => {
  it("é falso sem bloqueio registrado", () => {
    expect(isLocked({ lockedUntil: null }, NOW)).toBe(false);
  });

  it("é verdadeiro enquanto o bloqueio não venceu", () => {
    expect(isLocked({ lockedUntil: minutesAfter(1) }, NOW)).toBe(true);
  });

  it("expira exatamente no instante do vencimento (não fica preso)", () => {
    expect(isLocked({ lockedUntil: NOW }, NOW)).toBe(false);
  });
});

describe("attemptsRemaining", () => {
  it("conta pra baixo até zero", () => {
    expect(attemptsRemaining(0)).toBe(MAX_ATTEMPTS_BEFORE_LOCK);
    expect(attemptsRemaining(MAX_ATTEMPTS_BEFORE_LOCK - 1)).toBe(1);
    expect(attemptsRemaining(MAX_ATTEMPTS_BEFORE_LOCK)).toBe(0);
  });

  it("nunca é negativo", () => {
    expect(attemptsRemaining(MAX_ATTEMPTS_BEFORE_LOCK + 10)).toBe(0);
  });
});
