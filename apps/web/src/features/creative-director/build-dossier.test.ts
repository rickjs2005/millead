import { describe, expect, it } from "vitest";
import { buildDossier, dossierFileName } from "./build-dossier";
import { DEFAULT_SECTIONS } from "./options";
import type { CreativeDirection, CreativeInput } from "./types";

const input: CreativeInput = {
  businessName: "Padaria São Jorge",
  segment: "padaria artesanal",
  description: "Pães de fermentação natural e confeitaria",
  audience: "famílias do bairro",
  differentials: "fermentação de 48h",
  location: "Niterói / RJ",
  contact: "(21) 99999-0000",
  competitors: "Empório do Pão",
  averageTicket: "R$ 60 por compra",
  goal: "whatsapp",
  contentLanguage: "Português (Brasil)",
  emotion: "desejo",
  archetype: "criador",
  luxury: 2,
  boldness: 3,
  motion: 3,
  videoWeight: 2,
  designStyle: "editorial",
  palette: "",
  references: "",
  framework: "next-tailwind",
  language: "typescript",
  animation: "gsap",
  effects: [],
  sections: DEFAULT_SECTIONS,
  notes: "",
};

const direction: CreativeDirection = {
  analise: {
    posicionamento: "a padaria de fermentação longa do bairro",
    tomDeVoz: "próximo e sem pompa",
    dispositivoDominante: "mobile",
    nivelSeo: "alta — depende de busca local",
    objecoes: ["preço maior que o do mercado", "não sabe se está aberto"],
  },
  conceito: {
    nome: "Tempo como ingrediente",
    ideiaCentral: "a página inteira leva o tempo que o pão leva",
    metafora: "a massa que cresce",
    emocaoAlvo: "desejo",
    porqueFunciona: "transforma o custo (48h) no argumento",
  },
  narrativa: {
    ato1: "pão industrial",
    ato2: "fermentação",
    ato3: "a compra",
    fioCondutor: "tempo",
  },
  direcaoDeArte: {
    paleta: [{ hex: "#1B1712", papel: "fundo" }],
    tipografia: { display: "Canela", texto: "Söhne", porque: "contraste de época" },
    texturas: "papel pardo",
    grid: "assimétrico",
    luz: "janela lateral",
  },
  moodboard: [
    { categoria: "cinema", referencia: "O Sabor da Vida", oQueExtrair: "close de massa" },
  ],
  wireframe: [
    {
      secao: "Hero",
      objetivo: "provocar fome",
      objecaoQueResponde: "por que pagar mais",
      conteudo: "close do miolo",
      animacao: "mask reveal",
      temVideo: true,
    },
  ],
  cenas: [
    {
      ordem: 1,
      secaoDoSite: "Hero",
      descricao: "Massa crescendo em close",
      movimentoDeCamera: "push in",
      plano: "macro",
      iluminacao: "luz de janela",
      paletaCinematografica: "âmbar e marrom",
      duracaoSeg: 6,
      integracaoComScroll: "scroll sync",
      primeiroFrame: "massa fechada",
      ultimoFrame: "miolo aberto",
    },
  ],
  stills: [
    {
      uso: "Hero",
      descricao: "pão partido ao meio",
      camera: "Hasselblad",
      lente: "80mm",
      luz: "janela lateral",
      composicao: "centralizada",
    },
  ],
  copy: {
    headline: "Quarenta e oito horas antes de chegar à sua mesa",
    subheadline: "Fermentação natural, todo dia",
    ctaPrincipal: "Pedir no WhatsApp",
    ctasSecundarios: ["Ver o cardápio"],
  },
  extras: ["contador de fornadas em tempo real"],
};

describe("buildDossier — modo grátis", () => {
  const dossier = buildDossier(input);

  it("instrui a IA de destino a produzir a análise e o conceito", () => {
    expect(dossier.concept).toContain("Análise estratégica (a produzir)");
    expect(dossier.concept).toContain("Direção criativa (a produzir)");
    expect(dossier.codePrompt).toContain("Etapa 0");
  });

  it("mantém os dados do negócio em todos os artefatos relevantes", () => {
    expect(dossier.concept).toContain("Padaria São Jorge");
    expect(dossier.codePrompt).toContain("Padaria São Jorge");
  });

  it("não inventa cenas sem direção criativa, mas entrega o briefing de vídeo", () => {
    expect(dossier.video.enabled).toBe(true);
    expect(dossier.video.scenes).toHaveLength(0);
    expect(dossier.video.intro).toContain("Primeiro frame e último frame");
  });

  it("gera as proibições visuais e de copy no prompt de código", () => {
    expect(dossier.codePrompt).toContain("Proibições explícitas");
    expect(dossier.codePrompt).toContain("inovação");
    expect(dossier.codePrompt).toContain("hero centralizado");
  });
});

describe("buildDossier — com direção criativa", () => {
  const dossier = buildDossier(input, direction);

  it("materializa conceito, narrativa e moodboard", () => {
    expect(dossier.concept).toContain("Tempo como ingrediente");
    expect(dossier.concept).toContain("Fio condutor: tempo");
    expect(dossier.concept).toContain("O Sabor da Vida");
    expect(dossier.concept).not.toContain("(a produzir)");
  });

  it("leva o wireframe e a copy pro prompt de código", () => {
    expect(dossier.codePrompt).toContain("wireframe");
    expect(dossier.codePrompt).toContain("Quarenta e oito horas");
    expect(dossier.codePrompt).not.toContain("Etapa 0");
  });

  it("gera um prompt por engine em cada cena, com os frames de borda", () => {
    expect(dossier.video.scenes).toHaveLength(1);
    const scene = dossier.video.scenes[0]!;
    expect(scene.titulo).toContain("Cena 01");
    expect(scene.higgsfield).toContain("push in");
    expect(scene.higgsfield).toContain("massa fechada");
    expect(scene.veo).toContain("som ambiente");
    expect(scene.runway).toContain("Camera motion:");
    expect(scene.runway).toContain("End frame: miolo aberto");
  });

  it("gera os dois formatos de prompt de imagem", () => {
    expect(dossier.images).toContain("Midjourney");
    expect(dossier.images).toContain("--ar");
    expect(dossier.images).toContain("Flux / Leonardo");
  });

  it("junta tudo no arquivo completo", () => {
    expect(dossier.full).toContain(dossier.concept);
    expect(dossier.full).toContain(dossier.codePrompt);
    expect(dossier.full).toContain(dossier.checklists);
  });
});

describe("vídeo desligado", () => {
  it("desabilita a aba quando o peso do vídeo é zero", () => {
    const dossier = buildDossier({ ...input, videoWeight: 0 }, direction);
    expect(dossier.video.enabled).toBe(false);
    expect(dossier.video.scenes).toHaveLength(0);
    expect(dossier.codePrompt).toContain("não usa vídeo");
    expect(dossier.full).not.toContain("Higgsfield");
  });
});

describe("dossierFileName", () => {
  it("gera slug a partir do nome do negócio", () => {
    expect(dossierFileName(input)).toBe("direcao-criativa-padaria-sao-jorge.md");
  });

  it("cai num nome genérico quando não há negócio", () => {
    expect(dossierFileName({ ...input, businessName: "  " })).toBe("direcao-criativa-projeto.md");
  });
});
