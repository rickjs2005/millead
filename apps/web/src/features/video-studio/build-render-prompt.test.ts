import { describe, expect, it } from "vitest";
import { buildBrief } from "./build-brief";
import {
  buildRenderPrompt,
  buildSceneProps,
  buildTimelineTable,
  renderPromptFileName,
} from "./build-render-prompt";
import { templateById } from "./templates";
import type { VideoStudioForm } from "./types";

const createdAt = "2026-07-29T15:00:00.000Z";
const template = templateById("institucional")!;

function form(overrides: Partial<VideoStudioForm> = {}): VideoStudioForm {
  return {
    businessName: "MilWeb",
    url: "https://milweb.com.br",
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

const brief = buildBrief(form(), template, createdAt);

describe("buildTimelineTable", () => {
  const tabela = buildTimelineTable(brief);
  const linhas = tabela.split("\n");

  it("converte segundos em frames a 30fps", () => {
    // Primeira cena do Institucional: notebook, 3s -> 90 frames, começando em 0.
    expect(linhas[0]).toContain("| 0 | 90 |");
  });

  it("emenda as cenas sem buraco: cada from é a soma das anteriores", () => {
    let esperado = 0;
    brief.scenes.forEach((scene, i) => {
      expect(linhas[i]).toContain(`| ${esperado} | ${scene.durationSec * brief.fps} |`);
      esperado += scene.durationSec * brief.fps;
    });
  });

  it("mapeia cada tipo de cena ao seu componente", () => {
    expect(tabela).toContain("<NotebookScene />");
    expect(tabela).toContain("<GoogleSearchScene />");
    expect(tabela).toContain("<WhatsAppScene />");
    expect(tabela).toContain("<SiteScene />");
  });
});

describe("buildSceneProps", () => {
  const props = buildSceneProps(brief);

  it("aponta a imagem de cada cena de site pelo id do brief", () => {
    expect(props).toContain('imagem: "milweb-institucional/hero.jpg"');
  });

  it("descreve o zoom pelo rótulo do alvo", () => {
    expect(props).toMatch(/amplia: Título/);
  });

  it("diz plano fixo quando não há alvo marcado", () => {
    const semZoom = buildBrief(
      form({
        scenes: template.defaultScenes.map((s) =>
          s.slot === "hero" ? { ...s, zoomTargets: [] } : { ...s },
        ),
      }),
      template,
      createdAt,
    );
    expect(buildSceneProps(semZoom)).toContain("sem zoom — plano fixo na seção");
  });

  it("passa as props reais das cenas de estúdio", () => {
    expect(props).toContain('query: "MilWeb"');
    expect(props).toContain('resultado: "https://milweb.com.br"');
    expect(props).toContain('empresa: "MilWeb"');
  });
});

describe("buildRenderPrompt", () => {
  const prompt = buildRenderPrompt(brief);

  it("resolve a dimensão a partir do formato", () => {
    expect(prompt).toContain("1080x1920");
    expect(buildRenderPrompt(buildBrief(form({ format: "16:9" }), template, createdAt))).toContain(
      "1920x1080",
    );
  });

  it("traz o total de frames coerente com a duração", () => {
    expect(prompt).toContain(`${brief.totalDurationSec * brief.fps} frames`);
  });

  it("aponta o projeto Remotion que já existe, em vez de criar outro", () => {
    expect(prompt).toContain("projetos/remotion-video");
  });

  it("manda reusar os componentes compartilhados em vez de reescrever", () => {
    expect(prompt).toMatch(/reuse sem reescrever/i);
  });

  it("proíbe aleatoriedade, que faz o render tremer", () => {
    expect(prompt).toMatch(/Math\.random/);
  });

  it("exige assistir ao MP4 antes de declarar que funcionou", () => {
    expect(prompt).toMatch(/assista antes de dizer que funcionou/i);
  });

  it("manda parar quando falta arquivo capturado, em vez de usar placeholder", () => {
    expect(prompt).toMatch(/pare e diga qual falta/i);
  });

  it("omite a seção de material capturado quando a timeline só tem estúdio", () => {
    const soEstudio = buildBrief(
      form({ scenes: template.defaultScenes.map((s) => ({ ...s, enabled: s.kind === "studio" })) }),
      template,
      createdAt,
    );
    const semSite = buildRenderPrompt(soEstudio);
    expect(semSite).not.toContain("Material capturado");
    expect(semSite).not.toContain("SiteScene");
  });
});

describe("renderPromptFileName", () => {
  it("deriva do id do brief", () => {
    expect(renderPromptFileName(brief)).toBe("montagem-milweb-institucional.md");
  });
});
