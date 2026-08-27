import { describe, expect, it } from "vitest";
import { decodeBankFile } from "./decode-file.js";

/** Bytes de um texto em Windows-1252 (um byte por caractere). */
function latin1(text: string): ArrayBuffer {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i);
  return bytes.buffer;
}

function utf8(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

describe("decodeBankFile", () => {
  it("lê UTF-8 normalmente", () => {
    expect(decodeBankFile(utf8("Data;Histórico;Valor"))).toBe("Data;Histórico;Valor");
  });

  it("lê ISO-8859-1 sem transformar acento em lixo", () => {
    // É o caso que importa: banco brasileiro exporta assim, e ler como UTF-8
    // viraria "Hist�rico" — que entraria no fingerprint e duplicaria tudo na
    // reimportação.
    expect(decodeBankFile(latin1("Data;Histórico;Valor"))).toBe("Data;Histórico;Valor");
  });

  it("preserva a descrição acentuada de uma linha real", () => {
    const linha = "27/08/2026;MERCADINHO SÃO JOÃO;-1.234,56";
    expect(decodeBankFile(latin1(linha))).toBe(linha);
    expect(decodeBankFile(latin1(linha))).not.toContain("�");
  });

  it("arquivo ASCII puro dá o mesmo resultado nas duas codificações", () => {
    const linha = "27/08/2026;MERCADO;-120,00";
    expect(decodeBankFile(utf8(linha))).toBe(linha);
    expect(decodeBankFile(latin1(linha))).toBe(linha);
  });

  it("arquivo vazio não quebra", () => {
    expect(decodeBankFile(new ArrayBuffer(0))).toBe("");
  });
});
