import { describe, expect, it } from "vitest";
import { VideoBriefSchema } from "./brief.js";

function validBrief() {
  return {
    version: 1 as const,
    id: "kavita-drones-lancamento",
    createdAt: "2026-07-29T14:32:00.000Z",
    business: { name: "Kavita Drones", url: "https://kavita.com.br", segment: null },
    template: { id: "lancamento", name: "Lançamento de Site" },
    format: "9:16" as const,
    fps: 30,
    // As cenas abaixo somam 3+6+8 = 17s, e os orçamentos 8+15+20 = 43 palavras.
    // O superRefine exige que estes dois campos batam com as cenas.
    totalDurationSec: 17,
    wordBudget: 43,
    scenes: [
      {
        id: "sc1",
        kind: "studio" as const,
        component: "notebook" as const,
        durationSec: 3,
        zoomTargets: [],
      },
      {
        id: "sc2",
        kind: "studio" as const,
        component: "google" as const,
        durationSec: 6,
        zoomTargets: ["barra", "resultado"],
        query: "Kavita Drones",
        resultUrl: "https://kavita.com.br",
      },
      {
        id: "sc3",
        kind: "site" as const,
        slot: "hero" as const,
        durationSec: 8,
        zoomTargets: ["titulo", "botao"],
      },
    ],
    narration: { mode: "auto" as const, text: null, customInstructions: null },
  };
}

describe("VideoBriefSchema", () => {
  it("aceita um brief completo", () => {
    expect(() => VideoBriefSchema.parse(validBrief())).not.toThrow();
  });

  it("recusa version diferente de 1", () => {
    expect(() => VideoBriefSchema.parse({ ...validBrief(), version: 2 })).toThrow();
  });

  it("recusa cena google sem query", () => {
    const brief = validBrief();
    delete (brief.scenes[1] as Record<string, unknown>).query;
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });

  it("recusa slot de site desconhecido", () => {
    const brief = validBrief();
    (brief.scenes[2] as Record<string, unknown>).slot = "newsletter";
    expect(() => VideoBriefSchema.parse(brief)).toThrow();
  });

  it("recusa URL do negócio que não é URL", () => {
    const brief = validBrief();
    brief.business.url = "kavita";
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/url/i);
  });

  it("recusa id de cena duplicado", () => {
    const brief = validBrief();
    brief.scenes[2]!.id = "sc1";
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/duplicad/i);
  });

  it("recusa totalDurationSec que não bate com a soma das cenas", () => {
    const brief = validBrief();
    brief.totalDurationSec = 99;
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/soma/i);
  });

  it("exige texto quando o modo de narração é manual", () => {
    // Objeto novo em vez de mutação: `validBrief()` infere mode como "auto"
    // literal, e atribuir "manual" nele não compila.
    const brief = {
      ...validBrief(),
      narration: { mode: "manual", text: null, customInstructions: null },
    };
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/manual/i);
  });

  it("recusa duração de cena fracionária", () => {
    const brief = validBrief();
    (brief.scenes[0] as Record<string, unknown>).durationSec = 2.5;
    (brief as Record<string, unknown>).totalDurationSec = 16.5;
    expect(() => VideoBriefSchema.parse(brief)).toThrow(/inteiros/i);
  });
});
