import { describe, expect, it } from "vitest";
import { fingerprint } from "./fingerprint.js";

const base = {
  tag: "article",
  id: "produto-b",
  text: "DJI Agras T70P",
  imageSrc: "https://cdn.kavita.com.br/img/t70p.webp?v=3",
  siblingIndex: 2,
};

describe("fingerprint", () => {
  it("é determinístico", () => {
    expect(fingerprint(base)).toBe(fingerprint(base));
  });

  it("ignora mudança de classe (não entra no hash)", () => {
    const comClasse = { ...base } as Record<string, unknown>;
    comClasse.classes = ["p-4", "rounded-xl"];
    expect(fingerprint(comClasse as typeof base)).toBe(fingerprint(base));
  });

  it("ignora querystring e caminho da imagem, olha só o nome do arquivo", () => {
    const outroCdn = { ...base, imageSrc: "/assets/v2/t70p.webp" };
    expect(fingerprint(outroCdn)).toBe(fingerprint(base));
  });

  it("ignora diferença de espaço em branco e caixa no texto", () => {
    const espacado = { ...base, text: "  DJI   AGRAS\n T70P " };
    expect(fingerprint(espacado)).toBe(fingerprint(base));
  });

  it("muda quando o texto muda de verdade", () => {
    expect(fingerprint({ ...base, text: "DJI Agras T100" })).not.toBe(fingerprint(base));
  });

  it("muda quando a posição entre irmãos muda", () => {
    expect(fingerprint({ ...base, siblingIndex: 3 })).not.toBe(fingerprint(base));
  });

  it("funciona sem id, sem texto e sem imagem", () => {
    expect(fingerprint({ tag: "div", siblingIndex: 0 })).toHaveLength(16);
  });
});
