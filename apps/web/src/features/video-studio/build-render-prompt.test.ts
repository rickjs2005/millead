import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import { buildBrief } from "./build-brief";
import {
  buildRenderPrompt,
  buildSceneProps,
  buildTimelineTable,
  renderPromptFileName,
} from "./build-render-prompt";
import { sectionsFromSnapshot, zoomCandidatesFor } from "./from-snapshot";
import { templateById } from "./templates";
import type { SiteFormScene, VideoStudioForm } from "./types";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "testing", "snapshot-milweb.json");
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));
const secoes = sectionsFromSnapshot(snapshot);

const createdAt = "2026-07-29T15:00:00.000Z";
const template = templateById("institucional")!;

/** Monta uma SiteFormScene a partir de uma seção REAL da fixture, com override do que o teste precisa exercitar. */
function siteSceneFrom(sectionId: string, overrides: Partial<SiteFormScene> = {}): SiteFormScene {
  const secao = secoes.find((s) => s.sectionId === sectionId)!;
  return {
    id: `site-${sectionId}`,
    kind: "site",
    enabled: true,
    durationSec: 5,
    sectionId: secao.sectionId,
    label: secao.label,
    screenshot: secao.screenshot,
    sourceNodeId: secao.nodeId,
    zoomTargets: [],
    ...overrides,
  };
}

function form(overrides: Partial<VideoStudioForm> = {}): VideoStudioForm {
  return {
    businessName: "MilWeb",
    url: "https://milweb.com.br",
    segment: "",
    templateId: template.id,
    totalDurationSec: 30,
    format: "9:16",
    scenes: template.defaultScenes.map((s) => ({ ...s })),
    snapshotId: snapshot.id,
    narrationMode: "auto",
    narrationText: "",
    customInstructions: "",
    ...overrides,
  };
}

const raioXNodeId = secoes.find((s) => s.sectionId === "raio-x")!.nodeId;
const alvoDoDiagnostico = zoomCandidatesFor(snapshot, raioXNodeId).find((t) => /diagn/i.test(t.label))!;

/** Timeline com uma cena de site (raio-x) trazendo alvo de zoom com caixa real medida. */
const brief = buildBrief(
  form({
    scenes: [
      ...template.defaultScenes.map((s) => ({ ...s })),
      siteSceneFrom("raio-x", { zoomTargets: [alvoDoDiagnostico] }),
    ],
  }),
  template,
  createdAt,
);

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

  it("usa o label real da seção, não um rótulo de catálogo", () => {
    expect(tabela).toContain("Depender só de rede social custa caro");
  });
});

describe("buildSceneProps", () => {
  const props = buildSceneProps(brief);

  it("cita o arquivo real da seção, não um caminho de convenção de slot", () => {
    expect(props).toContain('imagem: "sections/raio-x.jpg"');
  });

  it("cita a caixa em pixel do alvo de zoom", () => {
    expect(props).toMatch(/\{ *x: *\d+/);
    expect(props).toContain(`amplia: ${alvoDoDiagnostico.label} em { x: ${alvoDoDiagnostico.box.x}`);
  });

  it("diz plano fixo quando não há alvo marcado", () => {
    const semZoom = buildBrief(
      form({
        scenes: [...template.defaultScenes.map((s) => ({ ...s })), siteSceneFrom("raio-x", { zoomTargets: [] })],
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

  it("arredonda a caixa: fração de pixel é ruído de medição do DOM", () => {
    // O alvo da fixture tem y = 4215.515625, medido por getBoundingClientRect.
    // Num texto que um modelo vai ler para escrever código, isso é só ruído.
    const prompt = buildRenderPrompt(brief);
    expect(prompt).toContain("y: 4216");
    expect(prompt).not.toContain("4215.515625");
  });

  it("resolve a dimensão a partir do formato", () => {
    expect(prompt).toContain("1080x1920");
    const outroFormato = buildBrief(form({ format: "16:9" }), template, createdAt);
    expect(buildRenderPrompt(outroFormato)).toContain("1920x1080");
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

  it("cita o arquivo real da seção", () => {
    expect(prompt).toContain("sections/raio-x.jpg");
  });

  it("cita a caixa em pixel do alvo de zoom", () => {
    expect(prompt).toMatch(/\{ *x: *\d+/);
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
    const soEstudio = buildBrief(form(), template, createdAt);
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
