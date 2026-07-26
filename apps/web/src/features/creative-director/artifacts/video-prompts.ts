/**
 * Aba 3 -- cenas de vídeo. Cada cena vira três prompts, um por engine, porque
 * cada uma espera um formato diferente:
 *   Higgsfield -- sujeito + ação + câmera + plano + luz + paleta + duração
 *   Veo        -- prosa cinematográfica contínua, com direção de áudio
 *   Runway     -- descrição + bloco de camera motion separado
 *
 * Os campos `primeiroFrame`/`ultimoFrame`/`integracaoComScroll` são o que faz o
 * vídeo deixar de ser elemento separado: a cena seguinte começa onde a anterior
 * parou e o scroll dirige a linha do tempo.
 */

import {
  CAMERA_MOVES,
  LIGHTING,
  SHOT_TYPES,
  VIDEO_TECHNIQUES,
  SCALES,
  scaleLevel,
} from "../options";
import { contentLanguage } from "../context";
import type { CreativeDirection, CreativeInput, DossierContext, VideoScene } from "../types";

type Scene = CreativeDirection["cenas"][number];

const NEGATIVES =
  "Sem texto na tela, sem legenda, sem logo, sem marca d'água, sem rosto de pessoa real identificável, sem deformação de mãos.";

function higgsfield(scene: Scene): string {
  return [
    scene.descricao,
    `Movimento de câmera: ${scene.movimentoDeCamera}.`,
    `Plano: ${scene.plano}.`,
    `Iluminação: ${scene.iluminacao}.`,
    `Paleta cinematográfica: ${scene.paletaCinematografica}.`,
    `Duração: ${scene.duracaoSeg}s.`,
    `Primeiro frame: ${scene.primeiroFrame}`,
    `Último frame: ${scene.ultimoFrame}`,
    "Fotorrealista, qualidade de comercial, 24fps, profundidade de campo natural.",
    NEGATIVES,
  ].join(" ");
}

function veo(scene: Scene): string {
  return [
    `${scene.descricao} A câmera faz ${scene.movimentoDeCamera.toLowerCase()} em ${scene.plano.toLowerCase()},`,
    `com ${scene.iluminacao.toLowerCase()} e uma paleta de ${scene.paletaCinematografica.toLowerCase()}.`,
    `A cena abre em ${scene.primeiroFrame.toLowerCase()} e termina em ${scene.ultimoFrame.toLowerCase()},`,
    "de modo que o corte seguinte continue exatamente deste enquadramento.",
    `Duração aproximada de ${scene.duracaoSeg} segundos, ritmo de comercial premium.`,
    "Áudio: som ambiente natural coerente com a cena, sem música e sem narração.",
    NEGATIVES,
  ].join(" ");
}

function runway(scene: Scene): string {
  return [
    scene.descricao,
    "",
    `Camera motion: ${scene.movimentoDeCamera} | ${scene.plano}`,
    `Lighting: ${scene.iluminacao}`,
    `Color: ${scene.paletaCinematografica}`,
    `Duration: ${scene.duracaoSeg}s`,
    `Start frame: ${scene.primeiroFrame}`,
    `End frame: ${scene.ultimoFrame}`,
    "",
    NEGATIVES,
  ].join("\n");
}

function toVideoScene(scene: Scene): VideoScene {
  const numero = String(scene.ordem).padStart(2, "0");
  return {
    ordem: scene.ordem,
    titulo: `Cena ${numero} · ${scene.secaoDoSite} · ${scene.movimentoDeCamera} · ${scene.iluminacao}`,
    secaoDoSite: scene.secaoDoSite,
    integracaoComScroll: scene.integracaoComScroll,
    duracaoSeg: scene.duracaoSeg,
    higgsfield: higgsfield(scene),
    veo: veo(scene),
    runway: runway(scene),
  };
}

/** Instruções pra IA de destino montar a lista de cenas (modo grátis). */
function instructions(input: CreativeInput): string {
  const scale = SCALES.find((s) => s.key === "videoWeight")!;
  return [
    "# Produção de vídeo",
    "",
    `Peso do vídeo neste projeto: ${scaleLevel(scale, input.videoWeight)}`,
    "",
    "Antes de gerar qualquer vídeo, monte a **lista de cenas** na ordem em que aparecem no site.",
    "Para cada cena, defina obrigatoriamente:",
    "",
    "1. Seção do site em que a cena vive",
    "2. Descrição do que acontece (sujeito, ação, ambiente)",
    "3. Movimento de câmera",
    "4. Tipo de plano",
    "5. Iluminação",
    "6. Paleta cinematográfica",
    "7. Duração em segundos",
    "8. Integração com o scroll (scroll sync, mouse sync, loop, reveal, transição)",
    "9. Primeiro frame e último frame descritos com precisão",
    "",
    "O item 9 não é opcional: é ele que permite que a cena seguinte **continue exatamente**",
    "de onde a anterior parou, e que a página emende vídeo e conteúdo sem costura visível.",
    "",
    "## Vocabulário disponível",
    "",
    `- Movimentos de câmera: ${CAMERA_MOVES.join(", ")}.`,
    `- Planos: ${SHOT_TYPES.join(", ")}.`,
    `- Iluminação: ${LIGHTING.join(", ")}.`,
    `- Técnicas: ${VIDEO_TECHNIQUES.join(", ")}.`,
    "",
    "## Formato de cada prompt",
    "",
    "**Higgsfield** — uma frase densa: descrição, movimento de câmera, plano, iluminação,",
    "paleta, duração, primeiro e último frame, e as negativas ao fim.",
    "",
    "**Veo** — prosa cinematográfica contínua, incluindo direção de áudio.",
    "",
    "**Runway** — descrição seguida de blocos separados: Camera motion, Lighting, Color,",
    "Duration, Start frame, End frame.",
    "",
    `Toda descrição textual do dossiê em ${contentLanguage(input)}; os prompts podem ser`,
    "escritos em inglês se a engine responder melhor assim.",
    "",
    `Negativas obrigatórias em todos: ${NEGATIVES}`,
  ].join("\n");
}

function richIntro(input: CreativeInput, direction: CreativeDirection): string {
  const scale = SCALES.find((s) => s.key === "videoWeight")!;
  const mapa = direction.cenas
    .map(
      (c) =>
        `- Cena ${String(c.ordem).padStart(2, "0")} → **${c.secaoDoSite}** · ${c.duracaoSeg}s · ${c.integracaoComScroll}`,
    )
    .join("\n");
  return [
    "# Produção de vídeo",
    "",
    `Peso do vídeo neste projeto: ${scaleLevel(scale, input.videoWeight)}`,
    "",
    "## Mapa das cenas no site",
    "",
    mapa,
    "",
    "Cada cena termina no frame em que a próxima começa — gere na ordem e mantenha a",
    "continuidade de escala, eixo e luz entre elas.",
  ].join("\n");
}

export function buildVideo({ input, direction }: DossierContext): {
  enabled: boolean;
  intro: string;
  scenes: VideoScene[];
} {
  if (input.videoWeight <= 0) {
    return {
      enabled: false,
      intro:
        "Este projeto está configurado sem vídeo. Aumente o slider **Peso do vídeo** no formulário para gerar cenas.",
      scenes: [],
    };
  }
  if (!direction || direction.cenas.length === 0) {
    return { enabled: true, intro: instructions(input), scenes: [] };
  }
  const scenes = [...direction.cenas].sort((a, b) => a.ordem - b.ordem).map(toVideoScene);
  return { enabled: true, intro: richIntro(input, direction), scenes };
}
