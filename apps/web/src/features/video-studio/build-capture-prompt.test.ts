import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import { buildBrief } from "./build-brief";
import {
  buildCaptureList,
  buildCapturePrompt,
  buildDoNotRecordList,
  capturePromptFileName,
} from "./build-capture-prompt";
import { sectionsFromSnapshot, zoomCandidatesFor } from "./from-snapshot";
import { templateById } from "./templates";
import type { SiteFormScene, VideoStudioForm } from "./types";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "testing", "snapshot-milweb.json");
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));
const secoes = sectionsFromSnapshot(snapshot);

const createdAt = "2026-07-29T14:32:00.000Z";
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

/** Timeline em que TODA cena de site marcada já tem miniatura -- nada a gravar. */
const briefComTodasAsMiniaturas = buildBrief(
  form({ scenes: [...template.defaultScenes.map((s) => ({ ...s })), siteSceneFrom("top")] }),
  template,
  createdAt,
);

const raioXCandidatos = zoomCandidatesFor(snapshot, secoes.find((s) => s.sectionId === "raio-x")!.nodeId);

/**
 * Timeline com uma cena capturada (top) e uma faltando (raio-x, `screenshot:
 * null` -- a fixture real sempre traz screenshot pronto, então forçamos a
 * ausência aqui para exercitar o caminho "falta capturar" sem inventar
 * seção/box: sectionId, label e alvo de zoom continuam vindo da fixture).
 */
const briefComUmaSemMiniatura = buildBrief(
  form({
    scenes: [
      ...template.defaultScenes.map((s) => ({ ...s })),
      siteSceneFrom("top"),
      siteSceneFrom("raio-x", { screenshot: null, zoomTargets: [raioXCandidatos[0]!] }),
    ],
  }),
  template,
  createdAt,
);

describe("buildCaptureList", () => {
  it("lista só as cenas de site sem miniatura, nunca as de estúdio", () => {
    const lista = buildCaptureList(briefComUmaSemMiniatura);
    expect(lista).toContain("[seção: raio-x]");
    expect(lista).not.toContain("[seção: top]");
    expect(lista).not.toContain("sections/top.jpg");
    expect(lista).not.toContain("notebook");
    expect(lista).not.toContain("google");
  });

  it("dá o nome de arquivo real da seção", () => {
    expect(buildCaptureList(briefComUmaSemMiniatura)).toContain("arquivo: sections/raio-x.jpg");
  });

  it("pede a medição das caixas dos alvos marcados, pelo rótulo", () => {
    expect(buildCaptureList(briefComUmaSemMiniatura)).toMatch(/medir a caixa de: Título/);
  });

  it("diz explicitamente quando a cena sem miniatura não tem alvo de zoom", () => {
    const semZoom = buildBrief(
      form({
        scenes: [
          ...template.defaultScenes.map((s) => ({ ...s })),
          siteSceneFrom("raio-x", { screenshot: null, zoomTargets: [] }),
        ],
      }),
      template,
      createdAt,
    );
    expect(buildCaptureList(semZoom)).toContain("(nenhum alvo de zoom marcado)");
  });

  it("avisa quando não há cena de site na timeline", () => {
    const soEstudio = buildBrief(form(), template, createdAt);
    expect(buildCaptureList(soEstudio)).toMatch(/nenhuma cena de site/i);
  });

  it("diz que não há nada a gravar quando toda cena marcada já tem miniatura", () => {
    expect(buildCaptureList(briefComTodasAsMiniaturas)).toMatch(/nada a gravar/i);
  });
});

describe("buildDoNotRecordList", () => {
  it("lista as cenas de estúdio da timeline", () => {
    const lista = buildDoNotRecordList(briefComUmaSemMiniatura);
    expect(lista).toContain("[notebook]");
    expect(lista).toContain("[google]");
    expect(lista).toContain("[whatsapp]");
  });

  it("não lista cena de estúdio que foi desmarcada", () => {
    const semGoogle = buildBrief(
      form({
        scenes: template.defaultScenes.map((s) =>
          s.component === "google" ? { ...s, enabled: false } : { ...s },
        ),
      }),
      template,
      createdAt,
    );
    expect(buildDoNotRecordList(semGoogle)).not.toContain("[google]");
  });
});

describe("buildCapturePrompt", () => {
  it("diz que não há nada a gravar quando toda cena marcada já tem miniatura", () => {
    const prompt = buildCapturePrompt(briefComTodasAsMiniaturas);
    expect(prompt).toMatch(/nada a gravar/i);
  });

  it("lista só as cenas sem miniatura", () => {
    const prompt = buildCapturePrompt(briefComUmaSemMiniatura);
    expect(prompt).toContain("[seção: raio-x]");
    expect(prompt).not.toContain("[seção: top]");
    expect(prompt).not.toContain("sections/top.jpg");
  });

  it("traz a URL e o viewport da captura quando falta algo", () => {
    const prompt = buildCapturePrompt(briefComUmaSemMiniatura);
    expect(prompt).toContain("https://milweb.com.br");
    expect(prompt).toContain("1920x1080");
  });

  it("manda resolver o lazy-load antes de fotografar", () => {
    expect(buildCapturePrompt(briefComUmaSemMiniatura)).toMatch(/role até o fim da página e volte ao topo/i);
  });

  it("exige coordenada de documento, não de viewport", () => {
    expect(buildCapturePrompt(briefComUmaSemMiniatura)).toMatch(/coordenadas de\s+DOCUMENTO/i);
  });

  it("proíbe screenshot de página inteira", () => {
    expect(buildCapturePrompt(briefComUmaSemMiniatura)).toMatch(/não\s+use screenshot de página inteira/i);
  });

  it("proíbe enviar formulário de verdade", () => {
    expect(buildCapturePrompt(briefComUmaSemMiniatura)).toMatch(/não clique em enviar/i);
  });

  it("manda dizer o que faltou em vez de inventar substituto", () => {
    expect(buildCapturePrompt(briefComUmaSemMiniatura)).toMatch(/não invente substituto/i);
  });

  it("não sobra chave de template — este prompt não usa substituição", () => {
    expect(buildCapturePrompt(briefComUmaSemMiniatura)).not.toContain("{{");
    expect(buildCapturePrompt(briefComTodasAsMiniaturas)).not.toContain("{{");
  });
});

describe("capturePromptFileName", () => {
  it("deriva do id do brief", () => {
    expect(capturePromptFileName(briefComTodasAsMiniaturas)).toBe("gravacao-milweb-institucional.md");
  });
});
