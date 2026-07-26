/**
 * Aba 4 -- stills. Prompts de imagem em dois formatos: Midjourney (parâmetros)
 * e Flux/Leonardo (prosa). Cobre hero, OG image, texturas e apoio de seção.
 */

import { contentLanguage } from "../context";
import type { CreativeDirection, CreativeInput, DossierContext } from "../types";

type Still = CreativeDirection["stills"][number];

const NEGATIVES =
  "sem texto, sem logo, sem marca d'água, sem colagem, sem rosto identificável de pessoa real";

function midjourney(still: Still, ar: string): string {
  return [
    still.descricao,
    still.camera,
    still.lente,
    still.luz,
    still.composicao,
    "fotografia editorial, alta fidelidade, grão fino",
  ]
    .filter(Boolean)
    .join(", ")
    .concat(` --ar ${ar} --style raw --stylize 250 --no ${NEGATIVES.replace(/sem /g, "")}`);
}

function fluxLeonardo(still: Still): string {
  return [
    still.descricao,
    `Fotografado com ${still.camera} e ${still.lente}.`,
    `Iluminação: ${still.luz}.`,
    `Composição: ${still.composicao}.`,
    `Acabamento de fotografia editorial, sem pós-produção artificial. Negativas: ${NEGATIVES}.`,
  ].join(" ");
}

/** Proporção sugerida pelo uso declarado. */
function aspectFor(uso: string): string {
  const u = uso.toLowerCase();
  if (u.includes("og") || u.includes("compartilh")) return "1.91:1";
  if (u.includes("hero") || u.includes("capa")) return "16:9";
  if (u.includes("retrato") || u.includes("mobile")) return "9:16";
  if (u.includes("textura") || u.includes("fundo")) return "1:1";
  return "3:2";
}

function instructions(input: CreativeInput): string {
  return [
    "# Imagens",
    "",
    "Produza a lista de stills necessários antes de gerar qualquer imagem. No mínimo:",
    "",
    "1. **Hero** — a imagem que sustenta a promessa central (16:9 e uma variação 9:16 para mobile)",
    "2. **OG image** — a imagem de compartilhamento (1.91:1), legível em miniatura",
    "3. **Apoio de seção** — uma por seção que precise de imagem, coerentes entre si",
    "4. **Texturas / fundos** — grão, papel, tecido, concreto ou o que a direção de arte pedir (1:1, repetível)",
    "",
    "Para cada still, defina: uso, descrição da cena, câmera, lente, iluminação e composição.",
    "Todas as imagens do projeto precisam parecer feitas na mesma sessão de fotos:",
    "mesma temperatura de cor, mesma qualidade de luz, mesma linguagem de enquadramento.",
    "",
    "## Formatos",
    "",
    "**Midjourney** — descrição, câmera, lente, luz, composição, seguidos de",
    "`--ar <proporção> --style raw --stylize 250` e as negativas.",
    "",
    "**Flux / Leonardo** — prosa contínua descrevendo cena, câmera, lente, luz e composição,",
    "com as negativas ao fim.",
    "",
    `Descrições do dossiê em ${contentLanguage(input)}; os prompts podem ir em inglês.`,
    "",
    `Negativas obrigatórias: ${NEGATIVES}.`,
  ].join("\n");
}

export function buildImages({ input, direction }: DossierContext): string {
  if (!direction || direction.stills.length === 0) return instructions(input);

  const blocks = direction.stills.map((still, i) => {
    const ar = aspectFor(still.uso);
    return [
      `## ${i + 1}. ${still.uso}`,
      "",
      still.descricao,
      "",
      "**Midjourney**",
      "",
      "```",
      midjourney(still, ar),
      "```",
      "",
      "**Flux / Leonardo**",
      "",
      "```",
      fluxLeonardo(still),
      "```",
    ].join("\n");
  });

  return [
    "# Imagens",
    "",
    "Todas as imagens precisam parecer feitas na mesma sessão: mesma temperatura de cor,",
    "mesma qualidade de luz, mesma linguagem de enquadramento.",
    "",
    ...blocks,
  ].join("\n");
}
