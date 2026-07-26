/**
 * Aba 2 -- o prompt que vai inteiro pro Claude Code (ou ChatGPT/Gemini).
 * É o artefato mais longo: carrega persona, padrão de qualidade, direção
 * criativa, wireframe, stack, animações, integração com vídeo, copy, SEO,
 * performance, acessibilidade, conversão e formato de entrega.
 */

import { analysisInstructions, creativeInstructions } from "../analysis-brief";
import {
  artDirectionBlock,
  businessBlock,
  conceptBlock,
  contentLanguage,
  copyBlock,
  isSingleFile,
  narrativeBlock,
  notesBlock,
  positioningBlock,
  sectionsBlock,
  stackBlock,
  visualBlock,
  wireframeBlock,
} from "../context";
import { BENCHMARK_STUDIOS, COPY_BANLIST, VISUAL_BANLIST, SCALES, scaleLevel } from "../options";
import type { CreativeInput, DossierContext } from "../types";

function deliveryBlock(input: CreativeInput): string {
  if (isSingleFile(input)) {
    return [
      "Entregue o código COMPLETO em um único arquivo, pronto pra salvar como .html e abrir no navegador.",
      "Sem placeholders do tipo “insira aqui”: preencha com conteúdo real e coerente.",
      "Se faltar uma imagem, gere um bloco de cor/gradiente tratado ou um SVG autoral — nunca deixe quebrado.",
    ].join(" ");
  }
  return [
    "Entregue o código COMPLETO e organizado, indicando o caminho de cada arquivo, um componente por seção.",
    "Inclua os arquivos de configuração necessários (Tailwind, tipos, fontes) e as instruções de instalação.",
    "Sem placeholders: preencha com conteúdo real e coerente.",
    "Onde faltar imagem, use um asset gerado pelos prompts de imagem deste dossiê ou um bloco tratado — nunca um placeholder cinza.",
  ].join(" ");
}

function videoIntegrationBlock(input: CreativeInput, hasScenes: boolean): string {
  if (input.videoWeight <= 0) {
    return [
      "Este projeto não usa vídeo. Toda a atmosfera precisa vir de tipografia, composição,",
      "cor, textura e movimento — o que aumenta a exigência sobre esses elementos.",
    ].join(" ");
  }
  const scale = SCALES.find((s) => s.key === "videoWeight")!;
  return [
    `Peso do vídeo neste projeto: ${scaleLevel(scale, input.videoWeight)}`,
    "",
    "O vídeo NUNCA é um elemento separado do site. Regras de integração:",
    "- O scroll é a linha do tempo: o progresso do vídeo é dirigido pela posição do scroll",
    "  (currentTime controlado por scroll, ou sequência de frames em canvas quando precisar de precisão).",
    "- O texto entra em sincronia com o vídeo, não por cima dele por acaso: cada bloco de copy",
    "  aparece no frame em que o vídeo o justifica.",
    "- A transição entre seções continua o movimento de câmera: a seção seguinte começa onde",
    "  o último frame parou (mesma escala, mesmo eixo, mesma luz).",
    "- O vídeo revela conteúdo e guia a navegação; ele não decora.",
    hasScenes
      ? "- As cenas estão descritas na aba Vídeo deste dossiê, com o primeiro e o último frame de cada uma — use-os para costurar as transições."
      : "- Descreva as cenas necessárias (movimento de câmera, plano, luz, duração, primeiro e último frame) antes de implementar.",
    "",
    'Implementação obrigatória: `preload="metadata"`, `playsinline`, `muted` para autoplay,',
    "poster tratado, fallback de imagem estática em conexões lentas e quando `prefers-reduced-motion`",
    "estiver ativo, e nada de vídeo bloqueando o first paint.",
  ].join("\n");
}

export function buildCodePrompt({ input, direction }: DossierContext): string {
  const lang = contentLanguage(input);
  const hasScenes = !!direction && direction.cenas.length > 0;

  const persona = [
    "Você acumula, neste projeto, os papéis de diretor criativo, diretor de arte, UX designer,",
    "motion designer, arquiteto front-end e especialista em conversão.",
    "Sua entrega é uma experiência digital memorável — não um site bonito.",
  ].join(" ");

  const standard = [
    "## Padrão de qualidade",
    "",
    `O resultado precisa passar por trabalho de estúdio como ${BENCHMARK_STUDIOS.join(", ")}.`,
    "",
    "Dois critérios eliminatórios:",
    "1. **Não pode parecer template.** Se o layout continuar fazendo sentido ao trocar o logo por",
    "   outro negócio qualquer, ele está errado e precisa ser refeito.",
    "2. **Não pode parecer gerado por IA.** Nada de estética média, simetria confortável e",
    "   vocabulário visual de biblioteca. Cada projeto tem identidade própria.",
  ].join("\n");

  const creative = direction
    ? [
        "## Direção criativa (já definida — siga)",
        "",
        "### Conceito",
        conceptBlock(direction),
        "",
        "### Narrativa",
        narrativeBlock(direction),
        "",
        "### Direção de arte",
        artDirectionBlock(direction),
        "",
        "### Copy âncora",
        copyBlock(direction),
      ].join("\n")
    : [
        "## Etapa 0 — antes de qualquer código",
        "",
        analysisInstructions(input),
        "",
        creativeInstructions(input),
      ].join("\n");

  const structure = direction
    ? ["## Estrutura da página (wireframe)", "", wireframeBlock(direction)].join("\n")
    : [
        "## Estrutura da página",
        "",
        sectionsBlock(input),
        "",
        "Para cada seção, defina antes de implementar: o objetivo, a objeção que ela derruba,",
        "o conteúdo e a animação. Seções que não respondem a nenhuma objeção devem ser cortadas.",
      ].join("\n");

  const motionScale = SCALES.find((s) => s.key === "motion")!;
  const boldnessScale = SCALES.find((s) => s.key === "boldness")!;

  return [
    persona,
    "",
    standard,
    "",
    "## Contexto do negócio",
    businessBlock(input),
    "",
    "## Posicionamento e intenção",
    positioningBlock(input),
    "",
    "## Parâmetros visuais",
    visualBlock(input),
    "",
    creative,
    "",
    structure,
    "",
    "## Arquitetura front-end",
    stackBlock(input),
    "",
    "Exigências de arquitetura:",
    "- Um componente por seção, com responsabilidade única e props tipadas.",
    "- Conteúdo (textos, itens, depoimentos) separado do layout, em constantes ou dados,",
    "  para que trocar copy não exija mexer em JSX.",
    "- Tokens de design em CSS custom properties: cores, escala tipográfica, espaçamento, raios,",
    "  durações e curvas de easing. Nada de valor mágico espalhado.",
    "- Tipografia e espaçamento fluidos com clamp(); variable fonts quando disponíveis.",
    "- Dark e light coerentes (não é inverter cores), respeitando prefers-color-scheme.",
    "",
    "## Movimento",
    "",
    `Densidade definida: ${scaleLevel(motionScale, input.motion)}`,
    `Ousadia permitida: ${scaleLevel(boldnessScale, input.boldness)}`,
    "",
    "Regras:",
    "- **Toda animação precisa de propósito declarado** — dirigir o olhar, revelar informação,",
    "  dar feedback ou criar continuidade entre seções. Animação sem propósito é ruído: corte.",
    "- Nada de easing linear. Use curvas customizadas ou spring; movimento com massa e inércia.",
    "- Stagger em listas e linhas de texto; entradas nunca simultâneas.",
    "- Anime apenas transform e opacity no caminho crítico; nada de animar layout.",
    "- `prefers-reduced-motion: reduce` desliga movimento não essencial mantendo a página completa.",
    "- Repertório disponível: microinterações, parallax em camadas, layer motion, profundidade,",
    "  física/spring, smooth scroll, scroll-driven animations, mouse tracking, cursor magnético,",
    "  hover reveal, mask reveal, clip-path, morph, stagger, movimento infinito e momentum.",
    "",
    "## Vídeo e experiência",
    "",
    videoIntegrationBlock(input, hasScenes),
    "",
    "## Copywriting",
    "",
    `- Todo o conteúdo em ${lang}, escrito por gente e para gente.`,
    "- Frases específicas ao negócio: números, nomes de serviço, o que o cliente realmente ganha.",
    `- **Proibido**: ${COPY_BANLIST.map((t) => `“${t}”`).join(", ")} — e qualquer construção do mesmo tipo.`,
    "- Nada de exclamação em série, de pergunta retórica na headline ou de promessa que o negócio não pode cumprir.",
    "- Nunca inventar fato verificável: telefone, endereço, prêmio, número de clientes ou depoimento",
    "  com nome de pessoa real. Faltou dado? Escreva a seção sem ele.",
    "",
    "## SEO",
    "",
    "- Metadados completos: title único, meta description, canonical, Open Graph e Twitter Cards.",
    "- JSON-LD com schema.org adequado ao negócio (LocalBusiness, Organization, Service, FAQPage,",
    "  BreadcrumbList — o que couber), com dados reais.",
    "- HTML semântico: um h1, hierarquia de headings correta, landmarks, listas de verdade.",
    "- Alt text descritivo em toda imagem com conteúdo; alt vazio no que for decorativo.",
    "- sitemap.xml e robots.txt quando o formato de entrega comportar.",
    "",
    "## Performance",
    "",
    "- Meta: Lighthouse 100 e Core Web Vitals no verde (LCP < 2.5s, INP < 200ms, CLS < 0.1).",
    "- Imagens em AVIF/WebP com dimensões declaradas, srcset e lazy-load fora da primeira dobra.",
    "- Fontes com preload do peso crítico, font-display: swap e subset.",
    "- Bibliotecas pesadas (3D, shaders, Lottie) sempre com import dinâmico e fallback estático.",
    "- Zero dependência que não pague o próprio peso.",
    "",
    "## Acessibilidade",
    "",
    "- Contraste AA no mínimo (AAA no texto corrido), foco visível e navegação completa por teclado.",
    "- Área de toque mínima de 44px, labels reais em formulários, mensagens de erro associadas.",
    "- Movimento e vídeo com controle do usuário; nada que dispare automaticamente com som.",
    "",
    "## Conversão",
    "",
    "- Cada seção derruba uma objeção específica — se não derruba, não existe.",
    "- CTA principal visível na primeira dobra e retomado ao fim, com o mesmo verbo.",
    "- Fricção mínima no formulário: só o campo que você realmente vai usar.",
    "- Prova social próxima do momento da decisão, não isolada no meio da página.",
    "",
    "## Proibições explícitas",
    "",
    ...VISUAL_BANLIST.map((v) => `- ${v}`),
    "",
    "## Formato de entrega",
    "",
    deliveryBlock(input),
    ...(notesBlock(input) ? ["", "## Observações adicionais", notesBlock(input)] : []),
    "",
    "---",
    "",
    "Se algum dado essencial estiver faltando, faça no máximo 2 perguntas objetivas antes de começar.",
    "Caso contrário, execute do início ao fim sem pedir confirmação.",
  ].join("\n");
}
