import { describe, expect, it } from "vitest";
import { parseImportedDate } from "./import-date.js";
import { formatUtcDate } from "./vault-date.js";

const dmy = (raw: string) => parseImportedDate(raw, "DMY");
const mdy = (raw: string) => parseImportedDate(raw, "MDY");

describe("parseImportedDate", () => {
  it("lê o formato brasileiro com barra e com traço", () => {
    expect(formatUtcDate(dmy("27/08/2026")!)).toBe("2026-08-27");
    expect(formatUtcDate(dmy("27-08-2026")!)).toBe("2026-08-27");
    expect(formatUtcDate(dmy("27.08.2026")!)).toBe("2026-08-27");
  });

  it("lê o formato americano quando o perfil diz MDY", () => {
    // Mesma string, ordem diferente: 08/07 é 8 de julho no Brasil e 7 de
    // agosto nos EUA. Só o perfil do banco sabe qual é.
    expect(formatUtcDate(dmy("08/07/2026")!)).toBe("2026-07-08");
    expect(formatUtcDate(mdy("08/07/2026")!)).toBe("2026-08-07");
  });

  it("lê ISO independente da ordem configurada", () => {
    // AAAA-MM-DD não é ambíguo: o ano de 4 dígitos na frente resolve.
    expect(formatUtcDate(dmy("2026-08-27")!)).toBe("2026-08-27");
    expect(formatUtcDate(mdy("2026-08-27")!)).toBe("2026-08-27");
  });

  it("lê o AAAAMMDD do OFX", () => {
    expect(formatUtcDate(dmy("20260827")!)).toBe("2026-08-27");
  });

  it("completa ano de dois dígitos no século atual", () => {
    expect(formatUtcDate(dmy("27/08/26")!)).toBe("2026-08-27");
  });

  it("NÃO desliza de dia por causa do fuso do Brasil", () => {
    // O ponto do teste: a data importada tem que ser exatamente a do extrato,
    // não importa em que fuso a API roda. Meia-noite UTC, sempre.
    for (const dia of ["01", "15", "28", "31"]) {
      const parsed = dmy(`${dia}/01/2026`)!;
      expect(parsed.toISOString()).toBe(`2026-01-${dia}T00:00:00.000Z`);
    }
  });

  it("recusa data que não existe no calendário", () => {
    expect(dmy("31/02/2026")).toBeNull();
    expect(dmy("32/01/2026")).toBeNull();
    expect(dmy("27/13/2026")).toBeNull();
  });

  it("recusa lixo em vez de devolver uma data qualquer", () => {
    expect(dmy("")).toBeNull();
    expect(dmy("data")).toBeNull();
    expect(dmy("27/08")).toBeNull();
  });

  it("aceita 29/02 em ano bissexto e recusa fora dele", () => {
    expect(formatUtcDate(dmy("29/02/2024")!)).toBe("2024-02-29");
    expect(dmy("29/02/2026")).toBeNull();
  });
});
