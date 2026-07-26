/**
 * Aba 1 -- Dossiê criativo. É o documento que o vendedor mostra ao cliente:
 * análise, conceito, narrativa, direção de arte e moodboard.
 */

import { analysisInstructions, creativeInstructions } from "../analysis-brief";
import {
  analysisBlock,
  artDirectionBlock,
  businessBlock,
  conceptBlock,
  copyBlock,
  moodboardBlock,
  narrativeBlock,
  positioningBlock,
  visualBlock,
} from "../context";
import type { DossierContext } from "../types";

export function buildConcept({ input, direction }: DossierContext): string {
  const head = [
    `# Direção criativa — ${input.businessName.trim() || "novo projeto"}`,
    "",
    "## Contexto do negócio",
    businessBlock(input),
    "",
    "## Posicionamento e intenção",
    positioningBlock(input),
    "",
    "## Parâmetros visuais definidos",
    visualBlock(input),
  ].join("\n");

  if (!direction) {
    return [
      head,
      "",
      "---",
      "",
      "## 1. Análise estratégica (a produzir)",
      analysisInstructions(input),
      "",
      "## 2. Direção criativa (a produzir)",
      creativeInstructions(input),
      "",
      "> Este dossiê está no **modo grátis**: os blocos acima são instruções.",
      "> Clique em “Direção criativa com IA” para que o conceito, a narrativa, a paleta,",
      "> o moodboard e as cenas sejam produzidos especificamente para este negócio.",
    ].join("\n");
  }

  return [
    head,
    "",
    "---",
    "",
    "## 1. Análise estratégica",
    analysisBlock(direction),
    "",
    "## 2. Conceito criativo",
    conceptBlock(direction),
    "",
    "## 3. Storytelling",
    narrativeBlock(direction),
    "",
    "## 4. Direção de arte",
    artDirectionBlock(direction),
    "",
    "## 5. Moodboard",
    moodboardBlock(direction),
    "",
    "## 6. Copy âncora",
    copyBlock(direction),
    ...(direction.extras.length
      ? ["", "## 7. Sugestões para elevar o projeto", ...direction.extras.map((e) => `- ${e}`)]
      : []),
  ].join("\n");
}
