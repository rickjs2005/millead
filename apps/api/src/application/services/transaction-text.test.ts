import { describe, expect, it } from "vitest";
import { extractInstallment, normalizeDescription } from "./transaction-text.js";

describe("normalizeDescription", () => {
  it("põe em maiúsculas e tira acento", () => {
    expect(normalizeDescription("Mercadinho São João")).toBe("MERCADINHO SAO JOAO");
  });

  it("colapsa espaço — extrato bancário vem cheio de padding", () => {
    expect(normalizeDescription("  IFOOD   *IFD   BRASIL  ")).toBe("IFOOD *IFD BRASIL");
  });

  it("é idempotente: normalizar duas vezes dá o mesmo", () => {
    const once = normalizeDescription("Compra   Café  ");
    expect(normalizeDescription(once)).toBe(once);
  });

  it("mantém o que distingue fornecedores", () => {
    // Não pode virar tudo igual: ANTHROPIC e ANTHROPIC PRO são pistas
    // diferentes, e apagar o sufixo estragaria a regra do usuário.
    expect(normalizeDescription("anthropic pro")).toBe("ANTHROPIC PRO");
    expect(normalizeDescription("CLAUDE.AI")).toBe("CLAUDE.AI");
  });

  it("aguenta string vazia e só espaço", () => {
    expect(normalizeDescription("")).toBe("");
    expect(normalizeDescription("   ")).toBe("");
  });
});

describe("extractInstallment", () => {
  it("lê os formatos comuns dos bancos brasileiros", () => {
    expect(extractInstallment("MAGAZINE LUIZA 03/12")).toEqual({ number: 3, total: 12 });
    expect(extractInstallment("MAGAZINE LUIZA PARC 3/12")).toEqual({ number: 3, total: 12 });
    expect(extractInstallment("LOJA (2/6)")).toEqual({ number: 2, total: 6 });
    expect(extractInstallment("LOJA PARCELA 2 DE 6")).toEqual({ number: 2, total: 6 });
  });

  it("devolve null quando não há parcela", () => {
    expect(extractInstallment("IFOOD *IFD BRASIL")).toBeNull();
    expect(extractInstallment("")).toBeNull();
  });

  it("não confunde data com parcela", () => {
    // 08/2026 é competência, não "parcela 8 de 2026".
    expect(extractInstallment("MENSALIDADE 08/2026")).toBeNull();
  });

  it("recusa parcela incoerente em vez de inventar", () => {
    expect(extractInstallment("LOJA 13/12")).toBeNull();
    expect(extractInstallment("LOJA 0/12")).toBeNull();
  });
});
