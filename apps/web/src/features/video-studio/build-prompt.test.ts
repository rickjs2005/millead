import { describe, expect, it } from "vitest";
import { buildBrief } from "./build-brief";
import { buildPrompt, buildSceneList, promptFileName } from "./build-prompt";
import { templateById } from "./templates";
import type { VideoStudioForm } from "./types";

const createdAt = "2026-07-29T14:32:00.000Z";
const template = templateById("lancamento")!;

function form(overrides: Partial<VideoStudioForm> = {}): VideoStudioForm {
  return {
    businessName: "Kavita Drones",
    url: "https://kavita.com.br",
    segment: "",
    templateId: template.id,
    totalDurationSec: 30,
    format: "9:16",
    scenes: template.defaultScenes.map((s) => ({ ...s })),
    narrationMode: "auto",
    narrationText: "",
    customInstructions: "",
    ...overrides,
  };
}

const briefAuto = buildBrief(form(), template, createdAt);

describe("buildSceneList", () => {
  const lista = buildSceneList(briefAuto);

  it("numera as cenas na ordem", () => {
    expect(lista.split("\n")[0]).toMatch(/^1\. /);
    expect(lista.split("\n")[1]).toMatch(/^2\. /);
  });

  it("mostra duração e orçamento de palavras de cada cena", () => {
    expect(lista).toContain("3s — 8 palavras");
  });

  it("mostra os alvos de zoom quando existem", () => {
    expect(lista).toMatch(/zoom: Barra de pesquisa, Primeiro resultado/);
  });

  it("não escreve 'zoom:' em cena sem alvo marcado", () => {
    const linhaNotebook = lista.split("\n")[0]!;
    expect(linhaNotebook).not.toContain("zoom:");
  });
});

describe("buildPrompt", () => {
  it("não deixa nenhuma variável por substituir", () => {
    expect(buildPrompt(briefAuto, template)).not.toContain("{{");
  });

  it("lança quando o template usa variável desconhecida", () => {
    const quebrado = { ...template, body: "Olá {{inexistente}}" };
    expect(() => buildPrompt(briefAuto, quebrado)).toThrow(/inexistente/);
  });

  it("injeta empresa, url, duração e orçamento", () => {
    const prompt = buildPrompt(briefAuto, template);
    expect(prompt).toContain("Kavita Drones");
    expect(prompt).toContain("https://kavita.com.br");
    expect(prompt).toContain("9:16 — 30 segundos");
    expect(prompt).toContain(`Total: ${briefAuto.wordBudget} palavras`);
  });

  it("no modo automático pede a narração do zero", () => {
    expect(buildPrompt(briefAuto, template)).toContain("Escreva a narração");
  });

  it("no modo manual pede ajuste e inclui o texto escrito", () => {
    const brief = buildBrief(
      form({ narrationMode: "manual", narrationText: "Conheça a Kavita." }),
      template,
      createdAt,
    );
    const prompt = buildPrompt(brief, template);
    expect(prompt).toContain("Conheça a Kavita.");
    expect(prompt).toMatch(/encaixe-a nos orçamentos/i);
    expect(prompt).not.toContain("Escreva a narração");
  });

  it("no modo custom acrescenta as instruções sem remover as regras fixas", () => {
    const brief = buildBrief(
      form({ narrationMode: "custom", customInstructions: "Use tom bem-humorado." }),
      template,
      createdAt,
    );
    const prompt = buildPrompt(brief, template);
    expect(prompt).toContain("Use tom bem-humorado.");
    expect(prompt).toContain("Nunca invente fato do negócio");
    expect(prompt).toContain("Respeite o orçamento de palavras");
  });
});

describe("promptFileName", () => {
  it("deriva do id do brief", () => {
    expect(promptFileName(briefAuto)).toBe("prompt-kavita-drones-lancamento.md");
  });
});
