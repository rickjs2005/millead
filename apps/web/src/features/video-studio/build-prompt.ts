import type { BriefScene, VideoBrief } from "@millead/video-contracts";
import { wordBudgetFor } from "./build-brief";
import { STUDIO_COMPONENT_INFO } from "./scenes";
import type { PromptTemplate } from "./types";

/** Rótulo real da cena: o `label` da seção do site, ou o nome do catálogo de estúdio. */
function sceneLabel(scene: BriefScene): string {
  return scene.kind === "site" ? scene.label : STUDIO_COMPONENT_INFO[scene.component].label;
}

function sceneTag(scene: BriefScene): string {
  return scene.kind === "site" ? scene.sectionId : scene.component;
}

/** Rótulos dos alvos de zoom marcados: já vêm prontos na cena de site, resolvidos pelo catálogo na de estúdio. */
function zoomLabels(scene: BriefScene): string {
  if (scene.kind === "site") {
    return scene.zoomTargets.map((t) => t.label).join(", ");
  }
  const catalogo = STUDIO_COMPONENT_INFO[scene.component].zoomTargets;
  return scene.zoomTargets.map((id) => catalogo.find((t) => t.id === id)?.label ?? id).join(", ");
}

export function buildSceneList(brief: VideoBrief): string {
  return brief.scenes
    .map((scene, index) => {
      const alvos = zoomLabels(scene);
      const partes = [
        `${index + 1}. [${sceneTag(scene)}] ${scene.durationSec}s — ${wordBudgetFor(scene.durationSec)} palavras — ${sceneLabel(scene)}`,
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
