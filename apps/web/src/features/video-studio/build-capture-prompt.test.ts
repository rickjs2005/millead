import { describe, expect, it } from "vitest";
import { buildBrief } from "./build-brief";
import {
  buildCaptureList,
  buildCapturePrompt,
  buildDoNotRecordList,
  capturePromptFileName,
} from "./build-capture-prompt";
import { templateById } from "./templates";
import type { VideoStudioForm } from "./types";

const createdAt = "2026-07-29T14:32:00.000Z";
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

describe("buildCaptureList", () => {
  const lista = buildCaptureList(brief);

  it("lista só as cenas de site", () => {
    expect(lista).toContain("[slot: hero]");
    expect(lista).toContain("[slot: sobre]");
    expect(lista).toContain("[slot: servicos]");
    expect(lista).toContain("[slot: formulario]");
    expect(lista).not.toContain("notebook");
    expect(lista).not.toContain("google");
  });

  it("dá um nome de arquivo por cena", () => {
    expect(lista).toContain("arquivo: hero.jpg");
    expect(lista).toContain("arquivo: formulario.jpg");
  });

  it("pede a medição das caixas dos alvos marcados, pelo rótulo", () => {
    expect(lista).toMatch(/medir a caixa de: Título/);
  });

  it("diz explicitamente quando a cena não tem alvo de zoom", () => {
    const semZoom = buildBrief(
      form({
        scenes: template.defaultScenes.map((s) =>
          s.slot === "sobre" ? { ...s, zoomTargets: [] } : { ...s },
        ),
      }),
      template,
      createdAt,
    );
    expect(buildCaptureList(semZoom)).toContain("(nenhum alvo de zoom marcado)");
  });

  it("avisa quando não há nada para gravar", () => {
    const soEstudio = buildBrief(
      form({ scenes: template.defaultScenes.map((s) => ({ ...s, enabled: s.kind === "studio" })) }),
      template,
      createdAt,
    );
    expect(buildCaptureList(soEstudio)).toMatch(/nenhuma cena de site/i);
  });
});

describe("buildDoNotRecordList", () => {
  it("lista as cenas de estúdio da timeline", () => {
    const lista = buildDoNotRecordList(brief);
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
  const prompt = buildCapturePrompt(brief);

  it("traz a URL e o viewport da captura", () => {
    expect(prompt).toContain("https://milweb.com.br");
    expect(prompt).toContain("1920x1080");
  });

  it("manda resolver o lazy-load antes de fotografar", () => {
    expect(prompt).toMatch(/role até o fim da página e volte ao topo/i);
  });

  it("exige coordenada de documento, não de viewport", () => {
    expect(prompt).toMatch(/coordenadas de\s+DOCUMENTO/i);
  });

  it("proíbe screenshot de página inteira", () => {
    expect(prompt).toMatch(/não\s+use screenshot de página inteira/i);
  });

  it("proíbe enviar formulário de verdade", () => {
    expect(prompt).toMatch(/não clique em enviar/i);
  });

  it("manda dizer o que faltou em vez de inventar substituto", () => {
    expect(prompt).toMatch(/não invente substituto/i);
  });

  it("não sobra chave de template — este prompt não usa substituição", () => {
    expect(prompt).not.toContain("{{");
  });
});

describe("capturePromptFileName", () => {
  it("deriva do id do brief", () => {
    expect(capturePromptFileName(brief)).toBe("gravacao-milweb-institucional.md");
  });
});
