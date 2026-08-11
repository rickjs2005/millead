import type { BriefScene, VideoBrief } from "@millead/video-contracts";
import { wordBudgetFor } from "./build-brief";
import { SITE_SLOT_INFO, STUDIO_COMPONENT_INFO } from "./scenes";
import type { PromptTemplate } from "./types";

function infoFor(scene: BriefScene): {
  label: string;
  zoomTargets: { id: string; label: string }[];
} {
  return scene.kind === "site"
    ? SITE_SLOT_INFO[scene.slot]
    : STUDIO_COMPONENT_INFO[scene.component];
}

function sceneTag(scene: BriefScene): string {
  return scene.kind === "site" ? scene.slot : scene.component;
}

export function buildSceneList(brief: VideoBrief): string {
  return brief.scenes
    .map((scene, index) => {
      const info = infoFor(scene);
      const alvos = scene.zoomTargets
        .map((id) => info.zoomTargets.find((t) => t.id === id)?.label ?? id)
        .join(", ");
      const partes = [
        `${index + 1}. [${sceneTag(scene)}] ${scene.durationSec}s — ${wordBudgetFor(scene.durationSec)} palavras — ${info.label}`,
      ];
      if (alvos) partes.push(`zoom: ${alvos}`);
      return partes.join("; ");
    })
    .join("\n");
}

/**
 * O bloco que muda conforme o modo. As REGRAS fixas do template (idioma,
 * orçamento, não inventar fato do negócio) ficam fora daqui de propósito:
 * instrução do usuário acrescenta, nunca desliga uma trava.
 */
function narrationBlock(brief: VideoBrief): string {
  switch (brief.narration.mode) {
    case "manual":
      return [
        "Abaixo está a narração já escrita. Encaixe-a nos orçamentos de palavras de",
        "cada cena, preservando o sentido e o tom. Não reescreva o que já cabe.",
        "",
        brief.narration.text ?? "",
      ].join("\n");
    case "custom":
      return [
        "Escreva a narração seguindo também estas instruções do autor:",
        "",
        brief.narration.customInstructions ?? "",
      ].join("\n");
    default:
      return "Escreva a narração de cada cena.";
  }
}

export function buildPrompt(brief: VideoBrief, template: PromptTemplate): string {
  // A guarda de chaves malformadas ({{ empresa }} com espaço, {{}} vazio etc.)
  // roda contra o TEMPLATE, antes da substituição -- nunca contra o resultado.
  // Texto do usuário (nome da empresa, narração manual, instruções próprias)
  // pode legitimamente conter "{{" e não deve derrubar o painel inteiro.
  if (/\{\{(?!\w+\}\})/.test(template.body)) {
    throw new Error(`variável malformada no template "${template.id}"`);
  }

  const valores: Record<string, string> = {
    empresa: brief.business.name,
    url: brief.business.url,
    duracao: String(brief.totalDurationSec),
    formato: brief.format,
    orcamentoPalavras: String(brief.wordBudget),
    cenas: buildSceneList(brief),
    blocoNarracao: narrationBlock(brief),
  };

  return template.body.replace(/\{\{(\w+)\}\}/g, (_match, chave: string) => {
    const valor = valores[chave];
    if (valor === undefined) {
      throw new Error(`variável desconhecida no template "${template.id}": {{${chave}}}`);
    }
    return valor;
  });
}

export function promptFileName(brief: VideoBrief): string {
  return `prompt-${brief.id}.md`;
}
