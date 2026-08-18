import { describe, expect, it } from "vitest";
import { boolEnv } from "./bool-env.js";

describe("boolEnv", () => {
  it('"false" desliga a flag (com z.coerce.boolean() virava true)', () => {
    expect(boolEnv(true).parse("false")).toBe(false);
  });

  it('"0" desliga a flag', () => {
    expect(boolEnv(true).parse("0")).toBe(false);
  });

  it('"true" e "1" ligam a flag', () => {
    expect(boolEnv(false).parse("true")).toBe(true);
    expect(boolEnv(false).parse("1")).toBe(true);
  });

  it("ignora espaço e caixa (o dashboard do Render guarda o que foi colado)", () => {
    expect(boolEnv(true).parse(" FALSE ")).toBe(false);
    expect(boolEnv(false).parse("True")).toBe(true);
  });

  it("variável ausente ou vazia cai no default", () => {
    expect(boolEnv(true).parse(undefined)).toBe(true);
    expect(boolEnv(false).parse(undefined)).toBe(false);
    expect(boolEnv(true).parse("")).toBe(true);
  });

  it("valor sem sentido quebra o boot em vez de virar true silenciosamente", () => {
    expect(() => boolEnv(false).parse("talvez")).toThrow();
  });
});
