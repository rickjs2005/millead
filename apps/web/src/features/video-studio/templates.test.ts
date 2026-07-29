import { describe, expect, it } from "vitest";
import { STUDIO_COMPONENT_INFO } from "./scenes";
import { TEMPLATES, templateById } from "./templates";

describe("TEMPLATES", () => {
  it("tem os cinco templates esperados", () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(
      ["captacao", "institucional", "lancamento", "loja", "portfolio"].sort(),
    );
  });

  // As cenas de site deixaram de ser um catálogo fechado: agora são um pedido
  // (`wants`) que `matchTemplate` casa contra o que o site tem de verdade.
  // Estas asserções, que antes somavam durationSec e conferiam alvo de zoom
  // por slot, passam a conferir que o pedido em si é coerente.
  it.each(TEMPLATES)("$id só declara wants com palavras-chave não vazias", (template) => {
    expect(template.wants.length).toBeGreaterThan(0);
    for (const want of template.wants) {
      expect(want.chave.length).toBeGreaterThan(0);
      expect(want.palavras.length).toBeGreaterThan(0);
      expect(want.palavras.every((p) => p.length > 0)).toBe(true);
      expect(want.durationSec).toBeGreaterThan(0);
    }
  });

  it.each(TEMPLATES)("$id tem chaves de want únicas", (template) => {
    const chaves = template.wants.map((w) => w.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it.each(TEMPLATES)("$id só usa cenas de estúdio válidas, com alvo de zoom conhecido", (template) => {
    for (const scene of template.defaultScenes) {
      expect(scene.kind).toBe("studio");
      expect(scene.component).toBeDefined();
      const validos = STUDIO_COMPONENT_INFO[scene.component!].zoomTargets.map((t) => t.id);
      for (const alvo of scene.zoomTargets) {
        expect(validos).toContain(alvo);
      }
    }
  });

  it.each(TEMPLATES)("$id tem ids de cena únicos entre defaultScenes", (template) => {
    const ids = template.defaultScenes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TEMPLATES)("$id tem siteInsertAt dentro do tamanho de defaultScenes", (template) => {
    expect(template.siteInsertAt).toBeGreaterThanOrEqual(0);
    expect(template.siteInsertAt).toBeLessThanOrEqual(template.defaultScenes.length);
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
