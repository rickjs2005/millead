import { describe, expect, it } from "vitest";
import { DEFAULT_SECTIONS } from "../options";
import type { CreativeInput } from "../types";
import { buildChecklists } from "./checklists";

const base: CreativeInput = {
  businessName: "Teste",
  segment: "",
  description: "",
  audience: "",
  differentials: "",
  location: "",
  contact: "",
  competitors: "",
  averageTicket: "",
  goal: "lead",
  contentLanguage: "Português (Brasil)",
  emotion: "confianca",
  archetype: "sabio",
  luxury: 2,
  boldness: 2,
  motion: 1,
  videoWeight: 0,
  designStyle: "minimalista",
  palette: "",
  references: "",
  framework: "next-tailwind",
  language: "typescript",
  animation: "subtle",
  effects: [],
  sections: DEFAULT_SECTIONS,
  notes: "",
};

function build(overrides: Partial<CreativeInput> = {}) {
  return buildChecklists({ input: { ...base, ...overrides }, direction: null });
}

describe("buildChecklists", () => {
  it("sempre entrega as seis listas", () => {
    const out = build();
    for (const title of [
      "UX",
      "Performance",
      "SEO",
      "Responsividade",
      "Acessibilidade",
      "Conversão",
    ]) {
      expect(out).toContain(`## ${title}`);
    }
  });

  it("exige fallback sem WebGL quando há 3D ou shader", () => {
    expect(build({ effects: ["three"] })).toContain("Fallback estático");
    expect(build()).not.toContain("Fallback estático");
  });

  it("acrescenta os itens de vídeo só quando há vídeo", () => {
    expect(build({ videoWeight: 3 })).toContain("Vídeo não bloqueia o first paint");
    expect(build()).not.toContain("Vídeo não bloqueia o first paint");
  });

  it("adapta a lista de conversão ao objetivo", () => {
    expect(build({ goal: "whatsapp" })).toContain("mensagem pré-preenchida");
    expect(build({ goal: "agendamento" })).toContain("leva direto ao calendário");
    expect(build({ goal: "whatsapp" })).not.toContain("leva direto ao calendário");
  });

  it("pede sitemap só quando o formato não é arquivo único", () => {
    expect(build()).toContain("sitemap.xml");
    expect(build({ framework: "html-css" })).not.toContain("sitemap.xml");
  });

  it("pede LocalBusiness quando existe localização", () => {
    expect(build({ location: "Niterói / RJ" })).toContain("LocalBusiness");
    expect(build()).not.toContain("LocalBusiness");
  });

  it("desativa o cursor customizado no toque quando o efeito está ligado", () => {
    expect(build({ effects: ["cursor"] })).toContain("Cursor customizado desativado");
  });
});
