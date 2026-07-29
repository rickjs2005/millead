import type { BriefScene, VideoBrief } from "@millead/video-contracts";
import { SITE_SLOT_INFO, STUDIO_COMPONENT_INFO } from "./scenes";

/**
 * Prompt de GRAVAÇÃO: instrui quem for capturar o site (hoje uma sessão do
 * Claude Code com automação de navegador; amanhã o apps/runner) a produzir o
 * material bruto de cada cena.
 *
 * Só cenas `site` são gravadas. As de estúdio -- notebook, Google, WhatsApp,
 * logo -- são renderizadas em React no Remotion e aparecem aqui apenas como
 * aviso explícito de NÃO gravar, porque é o erro natural de quem lê a timeline
 * e sai capturando tudo.
 */

const VIEWPORT = { width: 1920, height: 1080 } as const;

function siteScenes(brief: VideoBrief): Extract<BriefScene, { kind: "site" }>[] {
  return brief.scenes.filter(
    (scene): scene is Extract<BriefScene, { kind: "site" }> => scene.kind === "site",
  );
}

function studioScenes(brief: VideoBrief): Extract<BriefScene, { kind: "studio" }>[] {
  return brief.scenes.filter(
    (scene): scene is Extract<BriefScene, { kind: "studio" }> => scene.kind === "studio",
  );
}

function zoomLabels(scene: Extract<BriefScene, { kind: "site" }>): string[] {
  const info = SITE_SLOT_INFO[scene.slot];
  return scene.zoomTargets.map((id) => info.zoomTargets.find((t) => t.id === id)?.label ?? id);
}

/** Uma entrada por cena de site, com o que capturar e o que medir. */
export function buildCaptureList(brief: VideoBrief): string {
  const cenas = siteScenes(brief);
  if (cenas.length === 0) {
    return "(nenhuma cena de site nesta timeline — não há o que gravar)";
  }

  return cenas
    .map((scene, index) => {
      const info = SITE_SLOT_INFO[scene.slot];
      const alvos = zoomLabels(scene);
      const linhas = [
        `${index + 1}. ${info.label}  [slot: ${scene.slot}]  ${scene.durationSec}s`,
        `   arquivo: ${scene.slot}.jpg`,
        `   capturar: a seção inteira, do topo ao fim, sem cortar`,
      ];
      if (alvos.length > 0) {
        linhas.push(`   medir a caixa de: ${alvos.join(", ")}`);
      } else {
        linhas.push("   medir a caixa de: (nenhum alvo de zoom marcado)");
      }
      return linhas.join("\n");
    })
    .join("\n\n");
}

/** Lista das cenas que NÃO devem ser gravadas, com o motivo. */
export function buildDoNotRecordList(brief: VideoBrief): string {
  const cenas = studioScenes(brief);
  if (cenas.length === 0) return "(nenhuma — esta timeline só tem cenas de site)";

  return cenas
    .map((scene) => `- ${STUDIO_COMPONENT_INFO[scene.component].label}  [${scene.component}]`)
    .join("\n");
}

export function buildCapturePrompt(brief: VideoBrief): string {
  const cenasDeSite = siteScenes(brief).length;

  return [
    "Você vai gravar o material bruto de um vídeo de divulgação de site.",
    "Não monte o vídeo, não escreva narração: só capture e meça.",
    "",
    `Site: ${brief.business.url}`,
    `Empresa: ${brief.business.name}`,
    `Viewport: ${VIEWPORT.width}x${VIEWPORT.height}, deviceScaleFactor 1`,
    `Formato final do vídeo: ${brief.format} (o recorte vertical acontece depois, na montagem)`,
    "",
    "## Antes de capturar",
    "",
    "1. Abra a URL e espere a rede assentar.",
    "2. Role até o fim da página e volte ao topo. Isso força imagem com lazy-load",
    "   a carregar — sem esse passo, metade das fotos sai em branco.",
    "3. Espere as fontes carregarem antes da primeira foto.",
    "",
    "## O que capturar",
    "",
    `${cenasDeSite} cena(s) de site:`,
    "",
    buildCaptureList(brief),
    "",
    "Para cada uma:",
    "- Traga a seção para a tela, espere a animação assentar, e fotografe o elemento.",
    "- Fotografe o ELEMENTO, não a tela inteira. Elemento que atravessa a dobra sai",
    "  cortado se você fotografar o viewport.",
    "- Anote a caixa `{x, y, w, h}` de cada alvo de zoom pedido, em coordenadas de",
    "  DOCUMENTO (posição absoluta na página), não de viewport. É isso que permite",
    "  a montagem ampliar o elemento certo depois.",
    "",
    "## O que NÃO gravar",
    "",
    buildDoNotRecordList(brief),
    "",
    "Essas cenas são desenhadas em React na montagem, nunca capturadas. Gravar o",
    "Google de verdade traz captcha, mudança de layout e idioma do navegador;",
    "gravar WhatsApp de verdade traz dado pessoal real para dentro do vídeo.",
    "",
    "## Cuidados",
    "",
    "- Site com animação de scroll: role em passos e espere assentar entre eles. Não",
    "  use screenshot de página inteira — em página com elemento fixo ou preso ao",
    "  scroll, ele sai duplicado ou rasgado.",
    "- Se a página tiver banner de cookie ou pop-up, feche ANTES de capturar e diga",
    "  no relatório que fechou.",
    "- Não preencha nem envie formulário de verdade: isso cria lead falso no CRM de",
    "  quem for dono do site. Se a cena de formulário pedir campos preenchidos, use",
    "  dado obviamente fictício e não clique em enviar.",
    "",
    "## O que devolver",
    "",
    "- Um arquivo de imagem por cena, com o nome indicado na lista acima.",
    "- Um JSON com a caixa medida de cada alvo:",
    '  { "slot": "hero", "alvos": [ { "id": "titulo", "box": { "x": 0, "y": 0, "w": 0, "h": 0 } } ] }',
    "- A altura total da página em pixels.",
    "- Uma linha por problema encontrado: seção que não existe no site, alvo de zoom",
    "  que não deu para identificar, banner que atrapalhou.",
    "",
    "Se alguma seção da lista não existir no site, NÃO invente substituto: diga qual",
    "faltou. A timeline foi decidida por uma pessoa e é ela quem ajusta.",
  ].join("\n");
}

export function capturePromptFileName(brief: VideoBrief): string {
  return `gravacao-${brief.id}.md`;
}
