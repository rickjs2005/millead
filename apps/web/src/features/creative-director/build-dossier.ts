/**
 * Orquestra os cinco artefatos. É a mesma função nos dois modos: sem
 * `direction`, os blocos que exigem invenção viram instruções; com ela, viram
 * conteúdo. O esqueleto do dossiê nunca muda.
 */

import { buildChecklists } from "./artifacts/checklists";
import { buildCodePrompt } from "./artifacts/code-prompt";
import { buildConcept } from "./artifacts/concept";
import { buildImages } from "./artifacts/image-prompts";
import { buildVideo } from "./artifacts/video-prompts";
import type { CreativeDirection, CreativeInput, Dossier, VideoScene } from "./types";

function videoMarkdown(intro: string, scenes: VideoScene[]): string {
  if (scenes.length === 0) return intro;
  const blocks = scenes.map((s) =>
    [
      `## ${s.titulo}`,
      "",
      `- Seção do site: ${s.secaoDoSite}`,
      `- Integração com o scroll: ${s.integracaoComScroll}`,
      `- Duração: ${s.duracaoSeg}s`,
      "",
      "**Higgsfield**",
      "",
      "```",
      s.higgsfield,
      "```",
      "",
      "**Veo**",
      "",
      "```",
      s.veo,
      "```",
      "",
      "**Runway**",
      "",
      "```",
      s.runway,
      "```",
    ].join("\n"),
  );
  return [intro, "", ...blocks].join("\n");
}

export function buildDossier(
  input: CreativeInput,
  direction: CreativeDirection | null = null,
): Dossier {
  const ctx = { input, direction };

  const concept = buildConcept(ctx);
  const codePrompt = buildCodePrompt(ctx);
  const video = buildVideo(ctx);
  const images = buildImages(ctx);
  const checklists = buildChecklists(ctx);

  const full = [
    concept,
    "",
    "---",
    "",
    "# Prompt de desenvolvimento",
    "",
    codePrompt,
    ...(video.enabled ? ["", "---", "", videoMarkdown(video.intro, video.scenes)] : []),
    "",
    "---",
    "",
    images,
    "",
    "---",
    "",
    checklists,
  ].join("\n");

  return { concept, codePrompt, video, images, checklists, full };
}

/** Nome de arquivo do download, derivado do negócio. */
export function dossierFileName(input: CreativeInput): string {
  const slug =
    input.businessName
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "projeto";
  return `direcao-criativa-${slug}.md`;
}
