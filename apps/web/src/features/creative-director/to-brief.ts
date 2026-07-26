/**
 * Traduz o formulário no briefing que vai pra IA. Tudo vira texto legível
 * (rótulos e níveis por extenso) -- o modelo não deve receber `value` de
 * select nem número de slider sem contexto.
 */

import {
  ANIMATIONS,
  ARCHETYPES,
  DESIGN_STYLES,
  EFFECTS,
  EMOTIONS,
  FRAMEWORKS,
  GOALS,
  LANGUAGES,
  SCALES,
  SECTIONS,
  findLabel,
  scaleLevel,
} from "./options";
import type { CreativeInput } from "./types";

export interface CreativeBriefPayload {
  businessName: string;
  segment: string;
  description: string;
  audience: string;
  differentials: string;
  competitors: string;
  averageTicket: string;
  location: string;
  contact: string;
  goal: string;
  contentLanguage: string;
  emotion: string;
  archetype: string;
  designStyle: string;
  palette: string;
  references: string;
  luxury: string;
  boldness: string;
  motion: string;
  videoWeight: string;
  sceneCount: number;
  sections: string[];
  stack: string;
  notes: string;
}

/** Quantas cenas pedir, por nível do slider de vídeo. */
const SCENES_BY_WEIGHT = [0, 1, 3, 5, 8];

function level(key: (typeof SCALES)[number]["key"], input: CreativeInput): string {
  const scale = SCALES.find((s) => s.key === key)!;
  return `${input[key]}/4 — ${scaleLevel(scale, input[key])}`;
}

export function toBrief(input: CreativeInput): CreativeBriefPayload {
  const effects = input.effects.map((e) => findLabel(EFFECTS, e));
  const stack = [
    findLabel(FRAMEWORKS, input.framework),
    findLabel(LANGUAGES, input.language),
    `animação ${findLabel(ANIMATIONS, input.animation).toLowerCase()}`,
    effects.length ? `recursos: ${effects.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const weight = Math.min(Math.max(Math.round(input.videoWeight), 0), SCENES_BY_WEIGHT.length - 1);

  return {
    businessName: input.businessName.trim(),
    segment: input.segment.trim(),
    description: input.description.trim(),
    audience: input.audience.trim(),
    differentials: input.differentials.trim(),
    competitors: input.competitors.trim(),
    averageTicket: input.averageTicket.trim(),
    location: input.location.trim(),
    contact: input.contact.trim(),
    goal: findLabel(GOALS, input.goal),
    contentLanguage: input.contentLanguage.trim() || "Português (Brasil)",
    emotion: findLabel(EMOTIONS, input.emotion),
    archetype: findLabel(ARCHETYPES, input.archetype),
    designStyle: findLabel(DESIGN_STYLES, input.designStyle),
    palette: input.palette.trim(),
    references: input.references.trim(),
    luxury: level("luxury", input),
    boldness: level("boldness", input),
    motion: level("motion", input),
    videoWeight: level("videoWeight", input),
    sceneCount: SCENES_BY_WEIGHT[weight]!,
    sections: input.sections.map((s) => findLabel(SECTIONS, s)),
    stack,
    notes: input.notes.trim(),
  };
}
