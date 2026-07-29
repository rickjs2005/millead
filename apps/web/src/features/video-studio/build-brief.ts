import { VideoBriefSchema, type BriefScene, type VideoBrief } from "@millead/video-contracts";
import type { FormScene, PromptTemplate, VideoStudioForm } from "./types";

/** PT-BR narrado em ritmo comercial: ~2,5 palavras por segundo. */
const PALAVRAS_POR_SEGUNDO = 2.5;

export function wordBudgetFor(durationSec: number): number {
  return Math.round(durationSec * PALAVRAS_POR_SEGUNDO);
}

export function totalDuration(scenes: FormScene[]): number {
  return scenes.filter((s) => s.enabled).reduce((total, s) => total + s.durationSec, 0);
}

export function totalWordBudget(scenes: FormScene[]): number {
  return scenes
    .filter((s) => s.enabled)
    .reduce((total, s) => total + wordBudgetFor(s.durationSec), 0);
}

/**
 * Escala proporcionalmente e distribui a sobra do arredondamento 1s por vez,
 * começando pelas cenas mais longas -- assim nenhuma cena absorve sozinha toda
 * a distorção. Cenas desmarcadas ficam intactas: não contam para o total.
 *
 * Limite honesto: a soma é exata enquanto `targetTotalSec` for maior ou igual
 * ao número de cenas habilitadas. Abaixo disso é aritmeticamente impossível
 * (cada cena tem piso de 1 segundo) -- todas ficam com 1s e o total é o número
 * de cenas.
 */
export function scaleDurations(scenes: FormScene[], targetTotalSec: number): FormScene[] {
  const atual = totalDuration(scenes);
  if (atual === 0) return scenes.map((s) => ({ ...s }));

  const escaladas = scenes.map((scene) =>
    scene.enabled
      ? { ...scene, durationSec: Math.max(1, Math.round((scene.durationSec / atual) * targetTotalSec)) }
      : { ...scene },
  );

  // Índices das cenas habilitadas, da mais longa para a mais curta.
  const ordem = escaladas
    .map((scene, index) => ({ index, durationSec: scene.durationSec, enabled: scene.enabled }))
    .filter((item) => item.enabled)
    .sort((a, b) => b.durationSec - a.durationSec)
    .map((item) => item.index);

  let sobra = targetTotalSec - totalDuration(escaladas);
  while (sobra !== 0) {
    let mudou = false;
    for (const index of ordem) {
      if (sobra === 0) break;
      const cena = escaladas[index]!;
      if (sobra > 0) {
        escaladas[index] = { ...cena, durationSec: cena.durationSec + 1 };
        sobra -= 1;
        mudou = true;
      } else if (cena.durationSec > 1) {
        escaladas[index] = { ...cena, durationSec: cena.durationSec - 1 };
        sobra += 1;
        mudou = true;
      }
    }
    // Nenhuma cena pôde encolher: o alvo é menor que o número de cenas.
    if (!mudou) break;
  }

  return escaladas;
}

export function briefId(businessName: string, templateId: string): string {
  const slug =
    businessName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto";
  return `${slug}-${templateId}`;
}

function toBriefScene(scene: FormScene, form: VideoStudioForm): BriefScene {
  const comum = {
    id: scene.id,
    durationSec: scene.durationSec,
    zoomTargets: scene.zoomTargets,
  };

  if (scene.kind === "site") {
    return { ...comum, kind: "site", slot: scene.slot! };
  }

  switch (scene.component) {
    case "google":
      return {
        ...comum,
        kind: "studio",
        component: "google",
        query: form.businessName.trim(),
        resultUrl: form.url.trim(),
      };
    case "whatsapp":
      return {
        ...comum,
        kind: "studio",
        component: "whatsapp",
        company: form.businessName.trim(),
        message: `Olá! Vim pelo site da ${form.businessName.trim()} e quero mais informações.`,
      };
    case "logo":
      return { ...comum, kind: "studio", component: "logo", tagline: null };
    default:
      return { ...comum, kind: "studio", component: "notebook" };
  }
}

export function buildBrief(
  form: VideoStudioForm,
  template: PromptTemplate,
  createdAt: string,
): VideoBrief {
  const ativas = form.scenes.filter((s) => s.enabled);
  if (ativas.length === 0) {
    throw new Error("nenhuma cena selecionada para gerar o vídeo");
  }

  const brief = {
    version: 1 as const,
    id: briefId(form.businessName, template.id),
    createdAt,
    business: {
      name: form.businessName.trim(),
      url: form.url.trim(),
      segment: form.segment.trim() || null,
    },
    template: { id: template.id, name: template.name },
    format: form.format,
    fps: 30,
    totalDurationSec: totalDuration(form.scenes),
    wordBudget: totalWordBudget(form.scenes),
    scenes: ativas.map((scene) => toBriefScene(scene, form)),
    narration: {
      mode: form.narrationMode,
      text: form.narrationMode === "manual" ? form.narrationText.trim() : null,
      customInstructions:
        form.narrationMode === "custom" ? form.customInstructions.trim() : null,
    },
  };

  const parsed = VideoBriefSchema.safeParse(brief);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }
  return parsed.data;
}
