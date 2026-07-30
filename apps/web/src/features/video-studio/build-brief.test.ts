import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import {
  briefId,
  buildBrief,
  scaleDurations,
  totalDuration,
  totalWordBudget,
  wordBudgetFor,
} from "./build-brief";
import { sectionsFromSnapshot } from "./from-snapshot";
import { matchTemplate } from "./match-template";
import { TEMPLATES, templateById } from "./templates";
import type { FormScene, VideoStudioForm } from "./types";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "testing", "snapshot-milweb.json");
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));
const secoes = sectionsFromSnapshot(snapshot);

const PRESETS = [15, 30, 45, 60] as const;

/**
 * Formulário de teste com a timeline montada de verdade contra a fixture do
 * milweb: as cenas de site vêm de `matchTemplate`, casadas com seções reais
 * do site (não inventadas), e `snapshotId` aponta para o Snapshot carregado.
 */
function form(overrides: Partial<VideoStudioForm> = {}): VideoStudioForm {
  const template = templateById("lancamento")!;
  const { scenes } = matchTemplate(template, secoes);
  return {
    businessName: "Kavita Drones",
    url: "https://kavita.com.br",
    segment: "",
    templateId: template.id,
    totalDurationSec: 30,
    format: "9:16",
    scenes: scenes.map((s) => ({ ...s })),
    snapshotId: snapshot.id,
    narrationMode: "auto",
    narrationText: "",
    customInstructions: "",
    ...overrides,
  };
}

describe("wordBudgetFor", () => {
  it("usa 2,5 palavras por segundo", () => {
    expect(wordBudgetFor(8)).toBe(20);
    expect(wordBudgetFor(3)).toBe(8);
  });
});

describe("scaleDurations", () => {
  for (const template of TEMPLATES) {
    for (const alvo of PRESETS) {
      it(`${template.id} escalado para ${alvo}s soma exatamente ${alvo}`, () => {
        const escaladas = scaleDurations(template.defaultScenes, alvo);
        expect(totalDuration(escaladas)).toBe(alvo);
      });
    }
  }

  it("nunca produz cena com menos de 1 segundo", () => {
    const escaladas = scaleDurations(templateById("loja")!.defaultScenes, 15);
    expect(escaladas.every((s) => s.durationSec >= 1)).toBe(true);
  });

  it("ignora cenas desmarcadas ao escalar", () => {
    const scenes = templateById("captacao")!.defaultScenes.map((s, i) =>
      i === 0 ? { ...s, enabled: false } : { ...s },
    );
    const escaladas = scaleDurations(scenes, 30);
    expect(totalDuration(escaladas)).toBe(30);
    expect(escaladas[0]!.durationSec).toBe(scenes[0]!.durationSec);
  });

  it("não concentra a sobra numa cena só ao reduzir bastante", () => {
    // Um total de 34s com uma cena bem maior que as outras (site, 15s),
    // escalado pra 15s: a maior cena não pode ficar do tamanho do alvo
    // inteiro enquanto as outras encolhem pro piso -- a redução é distribuída.
    // (Não usamos `template.defaultScenes` aqui: desde a Task 3 ele só tem
    // cenas de ESTÚDIO, e nenhum template sozinho tem esse desnível de porte
    // entre cenas -- a própria função é agnóstica a isso, então testamos com
    // uma timeline sintética que exercita o caso.)
    const original: FormScene[] = [
      { id: "sc1", kind: "studio", component: "notebook", enabled: true, durationSec: 3, zoomTargets: [] },
      { id: "sc2", kind: "studio", component: "google", enabled: true, durationSec: 5, zoomTargets: [] },
      { id: "sc3", kind: "site", enabled: true, durationSec: 15, zoomTargets: [] },
      { id: "sc4", kind: "studio", component: "whatsapp", enabled: true, durationSec: 6, zoomTargets: [] },
      { id: "sc5", kind: "studio", component: "logo", enabled: true, durationSec: 5, zoomTargets: [] },
    ];
    const escaladas = scaleDurations(original, 15);
    expect(totalDuration(escaladas)).toBe(15);
    expect(escaladas.every((s) => s.durationSec >= 1)).toBe(true);
    expect(Math.max(...escaladas.map((s) => s.durationSec))).toBeLessThan(15);
  });

  it("documenta o limite: alvo menor que o número de cenas", () => {
    // 7 cenas com piso de 1s não cabem em 5s -- todas ficam em 1s.
    const scenes: FormScene[] = Array.from({ length: 7 }, (_, i) => ({
      id: `sc${i + 1}`,
      kind: "studio",
      component: "notebook",
      enabled: true,
      durationSec: 1,
      zoomTargets: [],
    }));
    const escaladas = scaleDurations(scenes, 5);
    expect(escaladas.every((s) => s.durationSec === 1)).toBe(true);
    expect(totalDuration(escaladas)).toBe(scenes.length);
  });

  it("distribui sobra negativa por várias cenas em vez de despejar numa só", () => {
    // 8 cenas de 1s escaladas para 12s: cada uma arredonda para 2s (total 16),
    // sobrando -4. Despejar tudo na maior cena travaria em 1s e daria 15s.
    // Cena de site ainda não casada com uma seção (sem sectionId) -- válida
    // no formulário, mesmo que não sirva pra gerar um brief ainda.
    const scenes: FormScene[] = Array.from({ length: 8 }, (_, i) => ({
      id: `sc${i + 1}`,
      kind: "site",
      enabled: true,
      durationSec: 1,
      zoomTargets: [],
    }));

    const escaladas = scaleDurations(scenes, 12);

    expect(totalDuration(escaladas)).toBe(12);
    // A redução foi repartida: quatro cenas em 1s e quatro em 2s.
    expect(escaladas.filter((s) => s.durationSec === 1)).toHaveLength(4);
    expect(escaladas.filter((s) => s.durationSec === 2)).toHaveLength(4);
  });
});

describe("totalWordBudget", () => {
  it("é a soma dos orçamentos por cena, não o orçamento do total", () => {
    const scenes = [
      { ...templateById("lancamento")!.defaultScenes[0]!, durationSec: 3 },
      { ...templateById("lancamento")!.defaultScenes[1]!, durationSec: 3 },
    ];
    // round(3*2.5) = 8 duas vezes = 16; round(6*2.5) seria 15.
    expect(totalWordBudget(scenes)).toBe(16);
  });
});

describe("briefId", () => {
  it("faz slug do negócio com o template", () => {
    expect(briefId("Kavita Drones", "lancamento")).toBe("kavita-drones-lancamento");
  });

  it("tira acento e pontuação", () => {
    expect(briefId("Ação & Cia.", "loja")).toBe("acao-cia-loja");
  });

  it("cai num padrão quando o nome está vazio", () => {
    expect(briefId("   ", "loja")).toBe("projeto-loja");
  });
});

describe("buildBrief", () => {
  const createdAt = "2026-07-29T14:32:00.000Z";
  const template = templateById("lancamento")!;

  it("produz um brief que valida no schema", () => {
    expect(() => buildBrief(form(), template, createdAt)).not.toThrow();
  });

  it("deixa de fora as cenas desmarcadas", () => {
    const base = form();
    base.scenes[0]!.enabled = false;
    const brief = buildBrief(base, template, createdAt);
    expect(brief.scenes).toHaveLength(base.scenes.length - 1);
    expect(brief.totalDurationSec).toBe(totalDuration(base.scenes));
  });

  it("preenche as props da cena do Google com os dados do negócio", () => {
    const brief = buildBrief(form(), template, createdAt);
    const google = brief.scenes.find((s) => s.kind === "studio" && s.component === "google");
    expect(google).toMatchObject({ query: "Kavita Drones", resultUrl: "https://kavita.com.br" });
  });

  it("recusa URL inválida com mensagem em português", () => {
    expect(() => buildBrief(form({ url: "kavita" }), template, createdAt)).toThrow(/URL válida/i);
  });

  it("recusa quando nenhuma cena está marcada", () => {
    const base = form();
    base.scenes = base.scenes.map((s) => ({ ...s, enabled: false }));
    expect(() => buildBrief(base, template, createdAt)).toThrow(/nenhuma cena/i);
  });

  it("guarda o texto quando a narração é manual", () => {
    const brief = buildBrief(
      form({ narrationMode: "manual", narrationText: "Conheça a Kavita." }),
      template,
      createdAt,
    );
    expect(brief.narration).toEqual({
      mode: "manual",
      text: "Conheça a Kavita.",
      customInstructions: null,
    });
  });

  it("monta a cena de site a partir da seção real casada, com source apontando pro Snapshot", () => {
    const brief = buildBrief(form(), template, createdAt);
    const site = brief.scenes.find((s) => s.kind === "site");
    expect(site).toBeTruthy();
    expect(site).toMatchObject({
      kind: "site",
      sectionId: "top",
      source: { snapshotId: snapshot.id },
    });
  });

  it("recusa cena de site sem Snapshot carregado", () => {
    const base = form({ snapshotId: undefined });
    expect(() => buildBrief(base, template, createdAt)).toThrow(/snapshot/i);
  });

  it("recusa cena de site que ainda não foi casada com uma seção do site", () => {
    const base = form();
    const semSecao: FormScene = {
      id: "site-solto",
      kind: "site",
      enabled: true,
      durationSec: 5,
      zoomTargets: [],
    };
    base.scenes = [...base.scenes, semSecao];
    expect(() => buildBrief(base, template, createdAt)).toThrow(/seção/i);
  });
});
