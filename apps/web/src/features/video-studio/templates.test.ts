import { describe, expect, it } from "vitest";
import { zoomTargetsFor } from "./scenes";
import { TEMPLATES, templateById } from "./templates";

const TOTAIS: Record<string, number> = {
  institucional: 30,
  lancamento: 30,
  portfolio: 45,
  loja: 45,
  captacao: 30,
};

describe("TEMPLATES", () => {
  it("tem os cinco templates esperados", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(
      ["captacao", "institucional", "lancamento", "loja", "portfolio"].sort(),
    );
  });

  it.each(TEMPLATES)("$id soma exatamente o total declarado", (template) => {
    const soma = template.defaultScenes.reduce((total, s) => total + s.durationSec, 0);
    expect(soma).toBe(TOTAIS[template.id]);
  });

  it.each(TEMPLATES)("$id só usa alvos de zoom que existem na cena", (template) => {
    for (const scene of template.defaultScenes) {
      const validos = zoomTargetsFor(scene).map((t) => t.id);
      for (const alvo of scene.zoomTargets) {
        expect(validos).toContain(alvo);
      }
    }
  });

  it.each(TEMPLATES)("$id tem ids de cena únicos", (template) => {
    const ids = template.defaultScenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TEMPLATES)("$id declara todas as variáveis que o corpo usa", (template) => {
    const usadas = [...template.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    const conhecidas = [
      "empresa",
      "url",
      "duracao",
      "formato",
      "orcamentoPalavras",
      "cenas",
      "blocoNarracao",
    ];
    for (const variavel of usadas) {
      expect(conhecidas).toContain(variavel);
    }
  });

  it("templateById acha e devolve undefined pro que não existe", () => {
    expect(templateById("lancamento")?.name).toBe("Lançamento de Site");
    expect(templateById("nao-existe")).toBeUndefined();
  });
});
