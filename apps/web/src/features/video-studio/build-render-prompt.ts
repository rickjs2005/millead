import type { BriefScene, VideoBrief } from "@millead/video-contracts";
import { STUDIO_COMPONENT_INFO } from "./scenes";

/**
 * Prompt de MONTAGEM: instrui uma sessão do Claude Code a montar a composição
 * no projeto Remotion que já existe (`projetos/remotion-video`).
 *
 * A arquitetura que este prompt impõe é deliberada: os componentes de estúdio
 * (notebook, Google, WhatsApp, logo) moram UMA VEZ em `src/video-studio/`, e
 * cada cliente ganha só uma composição nova que os reusa. O contrário --
 * regenerar os componentes a cada vídeo -- faz o Claude reinventar a roda toda
 * vez e o resultado sai diferente entre clientes.
 */

const REMOTION_PROJECT = "projetos/remotion-video";
const SHARED_DIR = "src/video-studio";

function frames(durationSec: number, fps: number): number {
  return durationSec * fps;
}

function sceneComponent(scene: BriefScene): string {
  if (scene.kind === "studio") {
    switch (scene.component) {
      case "notebook":
        return "<NotebookScene />";
      case "google":
        return "<GoogleSearchScene />";
      case "whatsapp":
        return "<WhatsAppScene />";
      case "logo":
        return "<LogoScene />";
    }
  }
  return "<SiteScene />";
}

/** Uma linha por cena, com a janela em frames e o componente que a desenha. */
export function buildTimelineTable(brief: VideoBrief): string {
  let cursor = 0;
  return brief.scenes
    .map((scene) => {
      const dur = frames(scene.durationSec, brief.fps);
      const inicio = cursor;
      cursor += dur;
      const nome = scene.kind === "site" ? scene.label : STUDIO_COMPONENT_INFO[scene.component].label;
      return `| ${scene.id} | ${nome} | ${inicio} | ${dur} | ${sceneComponent(scene)} |`;
    })
    .join("\n");
}

/** A caixa de um alvo de zoom, no formato que o `SiteScene` do Remotion espera. */
function boxLiteral(box: { x: number; y: number; w: number; h: number }): string {
  return `{ x: ${box.x}, y: ${box.y}, w: ${box.w}, h: ${box.h} }`;
}

/** Props concretas de cada cena, já resolvidas a partir do brief. */
export function buildSceneProps(brief: VideoBrief): string {
  return brief.scenes
    .map((scene) => {
      if (scene.kind === "site") {
        const alvos = scene.zoomTargets
          .map((t) => `${t.label} em ${boxLiteral(t.box)}`)
          .join(", ");
        const zoom = alvos ? `amplia: ${alvos}` : "sem zoom — plano fixo na seção";
        const imagem = scene.screenshot ?? "(sem miniatura ainda — falta capturar)";
        return `- ${scene.id} · SiteScene · imagem: "${imagem}" · ${zoom}`;
      }
      switch (scene.component) {
        case "google":
          return `- ${scene.id} · GoogleSearchScene · query: "${scene.query}" · resultado: "${scene.resultUrl}"`;
        case "whatsapp":
          return `- ${scene.id} · WhatsAppScene · empresa: "${scene.company}" · mensagem: "${scene.message}"`;
        case "logo":
          return `- ${scene.id} · LogoScene · tagline: ${scene.tagline ? `"${scene.tagline}"` : "(nenhuma)"}`;
        default:
          return `- ${scene.id} · NotebookScene · sem props`;
      }
    })
    .join("\n");
}

export function buildRenderPrompt(brief: VideoBrief): string {
  const totalFrames = brief.scenes.reduce(
    (total, scene) => total + frames(scene.durationSec, brief.fps),
    0,
  );
  const [w, h] =
    brief.format === "9:16" ? [1080, 1920] : brief.format === "16:9" ? [1920, 1080] : [1080, 1080];
  const temSite = brief.scenes.some((s) => s.kind === "site");

  return [
    `Monte a composição de um vídeo de divulgação no projeto Remotion em \`${REMOTION_PROJECT}\`.`,
    "",
    `Cliente: ${brief.business.name}`,
    `Site: ${brief.business.url}`,
    `Composição: \`${brief.id}\` · ${w}x${h} · ${brief.fps}fps · ${totalFrames} frames (${brief.totalDurationSec}s)`,
    "",
    "## Antes de escrever código",
    "",
    `1. Leia \`${REMOTION_PROJECT}/src/Root.tsx\` e uma pasta de vídeo já existente`,
    "   (ex.: `src/reel/`) para seguir a convenção da casa: cada vídeo é uma pasta",
    "   com `timing.ts` exportando DURATION/FPS/WIDTH/HEIGHT, um componente de topo,",
    "   e `scenes/` para as cenas.",
    `2. Verifique se \`${REMOTION_PROJECT}/${SHARED_DIR}/\` já existe.`,
    "",
    "## A regra que governa este prompt",
    "",
    `Os componentes de cena de estúdio moram UMA VEZ em \`${SHARED_DIR}/components/\` e`,
    "são reusados por todo cliente. Se já existirem, **reuse sem reescrever**. Se não",
    "existirem, crie-os agora — e crie genéricos, recebendo tudo por prop, porque o",
    "próximo cliente vai usar os mesmos.",
    "",
    "Cada cliente ganha só uma pasta nova com a composição e o registro no `Root.tsx`.",
    "",
    "## Componentes compartilhados",
    "",
    "- `NotebookScene` — notebook fechado abrindo, revelando a tela. Sem props.",
    "- `GoogleSearchScene` — busca do Google **desenhada em React**, nunca capturada:",
    "  props `query` e `resultUrl`. Digitação na barra, resultado aparecendo, e o",
    "  primeiro resultado destacado. Sem logo do Google pixel-perfeito — evoque, não copie.",
    "- `WhatsAppScene` — conversa de WhatsApp desenhada em React: props `company` e",
    "  `message`. Mensagem chegando, com hora e check de entregue.",
    "- `LogoScene` — tela final: prop `tagline` (pode ser nula) e a URL do site.",
    ...(temSite
      ? [
          "- `SiteScene` — mostra um screenshot capturado do site: props `src` (via",
          "  `staticFile`), e opcionalmente uma caixa de zoom `{x, y, w, h}` em",
          "  coordenadas da imagem. Sem caixa, é plano fixo com deriva lenta; com caixa,",
          "  a câmera aproxima daquele retângulo ao longo da cena.",
        ]
      : []),
    "",
    "## Timeline",
    "",
    "Use `<Sequence from={...} durationInFrames={...}>` para cada cena, nesta ordem:",
    "",
    "| cena | o que é | from (frame) | duração (frames) | componente |",
    "| ---- | ------- | ------------ | ---------------- | ---------- |",
    buildTimelineTable(brief),
    "",
    "## Props de cada cena",
    "",
    buildSceneProps(brief),
    "",
    ...(temSite
      ? [
          "## Material capturado",
          "",
          `As imagens do site ficam em \`${REMOTION_PROJECT}/public/${brief.id}/\`, no`,
          "caminho indicado pelo campo `imagem` de cada cena acima (ex.:",
          `\`public/${brief.id}/sections/raio-x.jpg\`), e são lidas com \`staticFile()\`.`,
          "Se algum arquivo não estiver lá, **pare e diga qual falta** em vez de",
          "inventar placeholder que passa despercebido no render.",
          "",
          "Se a captura trouxe as caixas dos alvos de zoom, use-as no `SiteScene`.",
          "Sem elas, faça plano fixo e avise que o zoom ficou de fora.",
          "",
        ]
      : []),
    "## Regras de montagem",
    "",
    "- Transições curtas entre cenas (fade de 6 a 10 frames). Nada de efeito chamativo.",
    "- Nenhum texto na tela além das legendas que vierem da narração — o vídeo é vertical",
    "  e texto pequeno some no celular.",
    "- Cor da marca: tire dos próprios screenshots capturados. Não invente paleta.",
    "- Não invente fato do cliente: prêmio, número, telefone, endereço, depoimento.",
    "- Determinismo: nada de `Math.random()` ou `Date.now()` na composição. Remotion",
    "  renderiza frame a frame em paralelo — valor aleatório faz o vídeo tremer.",
    "",
    "## Ao terminar",
    "",
    "1. Registre a composição no `Root.tsx`, seguindo o padrão das que já estão lá.",
    `2. Rode \`npx remotion studio\` e confirme que \`${brief.id}\` aparece e toca.`,
    `3. Renderize: \`npx remotion render ${brief.id} out/${brief.id}.mp4\``,
    "4. **Abra o MP4 e assista antes de dizer que funcionou.** Composição que compila",
    "   e renderiza sem erro pode estar visualmente quebrada — cena em branco, imagem",
    "   esticada, zoom no lugar errado. Só olhando dá pra saber.",
    "",
    "A narração e as legendas vêm em separado, do prompt de narração. Se você ainda",
    "não as recebeu, monte o vídeo mudo e diga que faltam.",
  ].join("\n");
}

export function renderPromptFileName(brief: VideoBrief): string {
  return `montagem-${brief.id}.md`;
}
