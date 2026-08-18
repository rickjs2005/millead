import { describe, expect, it } from "vitest";
import { distribuirHoras, ETAPAS_PADRAO } from "./hours-from-product";

const soma = (horas: { hours: number }[]) => horas.reduce((acc, h) => acc + h.hours, 0);

describe("distribuirHoras", () => {
  it("Site Institucional (60h) vira um ponto de partida por etapa", () => {
    expect(distribuirHoras(60)).toEqual([
      { label: "Design", hours: 15 },
      { label: "Frontend", hours: 24 },
      { label: "Backend", hours: 12 },
      { label: "SEO", hours: 4 },
      { label: "Testes", hours: 5 },
    ]);
  });

  // Arredondar cinco etapas separadamente perde ou ganha hora, e a diferença
  // vira preço errado -- por isso a soma é o que mais importa aqui.
  it.each([24, 40, 60, 90, 150, 7, 1, 33])("a soma fecha exatamente com %ih", (base) => {
    expect(soma(distribuirHoras(base))).toBe(base);
  });

  it("produto sem horas-base não inventa hora nenhuma", () => {
    expect(soma(distribuirHoras(null))).toBe(0);
    expect(soma(distribuirHoras(0))).toBe(0);
  });

  it("sempre devolve as etapas padrão, na ordem, mesmo zeradas", () => {
    expect(distribuirHoras(null).map((h) => h.label)).toEqual(ETAPAS_PADRAO);
  });

  it("nenhuma etapa fica negativa quando o ajuste do arredondamento é pra baixo", () => {
    for (const base of [1, 2, 3, 7, 13, 24, 150]) {
      expect(distribuirHoras(base).every((h) => h.hours >= 0)).toBe(true);
    }
  });
});
