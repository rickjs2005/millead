/**
 * Aba 5 -- checklists de conferência. 100% determinísticos: derivam das
 * escolhas do formulário. Escolheu Three.js? entra fallback sem WebGL.
 * Escolheu vídeo? entram os itens de vídeo. É a lista que o vendedor usa pra
 * aceitar (ou recusar) o que a IA entregou.
 */

import { isSingleFile } from "../context";
import { findLabel, SECTIONS } from "../options";
import type { CreativeInput, DossierContext } from "../types";

function has(input: CreativeInput, effect: string): boolean {
  return input.effects.includes(effect);
}

function ux(input: CreativeInput): string[] {
  const items = [
    "A promessa central é entendida em menos de 5 segundos na primeira dobra.",
    "Cada seção responde a uma objeção específica do comprador.",
    "A hierarquia visual conduz o olhar na ordem da narrativa, não na ordem do HTML.",
    "Estados de hover, foco, carregando, vazio e erro existem em todo elemento interativo.",
    "Nenhuma seção repete a estrutura visual da anterior.",
    "O layout deixaria de fazer sentido se trocasse o logo por outro negócio (é o que se quer).",
  ];
  if (input.sections.includes("faq")) {
    items.push("O FAQ derruba objeções reais — não é um FAQ de fachada.");
  }
  if (input.sections.includes("precos")) {
    items.push("O plano recomendado está em destaque e cada plano tem CTA próprio.");
  }
  return items;
}

function performance(input: CreativeInput): string[] {
  const items = [
    "Lighthouse 100 em Performance, Acessibilidade, Boas práticas e SEO.",
    "LCP < 2.5s, INP < 200ms, CLS < 0.1 em 4G simulado.",
    "Imagens em AVIF/WebP, com width/height declarados e lazy-load fora da primeira dobra.",
    "Fontes com preload do peso crítico, font-display: swap e subset aplicado.",
    "Nenhuma dependência que não pague o próprio peso.",
  ];
  if (has(input, "three") || has(input, "shaders") || has(input, "spline")) {
    items.push("Cena 3D/shader carregada por import dinâmico, pausada fora da viewport.");
    items.push("Fallback estático (imagem ou gradiente tratado) quando não houver WebGL.");
    items.push("Frame rate estável em notebook integrado, não só na máquina do dev.");
  }
  if (has(input, "lottie")) {
    items.push("Lottie carregado sob demanda e pausado fora da viewport.");
  }
  if (has(input, "particles")) {
    items.push("Canvas de partículas com contagem reduzida em mobile e pausado fora da viewport.");
  }
  if (input.videoWeight > 0) {
    items.push("Vídeo não bloqueia o first paint; poster tratado aparece antes do primeiro frame.");
    items.push("Versão leve (ou imagem estática) servida em conexão lenta.");
  }
  return items;
}

function seo(input: CreativeInput): string[] {
  const items = [
    "Title único e meta description escritos pra clique, não pra robô.",
    "Canonical, Open Graph e Twitter Cards preenchidos e testados no preview.",
    "JSON-LD com schema.org adequado ao negócio, validado e com dados reais.",
    "Um único h1; hierarquia de headings sem pulos.",
    "Alt text descritivo no conteúdo, alt vazio no decorativo.",
  ];
  if (!isSingleFile(input)) {
    items.push("sitemap.xml e robots.txt presentes e corretos.");
  }
  if (input.sections.includes("faq")) {
    items.push("FAQPage no JSON-LD, espelhando o FAQ real da página.");
  }
  if (input.sections.includes("mapa") || input.location.trim()) {
    items.push("LocalBusiness no JSON-LD com endereço e horário reais.");
  }
  return items;
}

function responsive(input: CreativeInput): string[] {
  const items = [
    "Testado em 360px, 768px, 1280px e 1920px sem quebra nem scroll horizontal.",
    "Tipografia e espaçamento fluidos (clamp), sem saltos entre breakpoints.",
    "Área de toque mínima de 44px em tudo que é clicável.",
    "Safe areas do iOS respeitadas (notch e barra inferior).",
    "Nada depende de hover para funcionar em touch.",
  ];
  if (has(input, "cursor")) {
    items.push("Cursor customizado desativado em dispositivos de toque.");
  }
  if (has(input, "container-queries")) {
    items.push("Componentes reagem ao contêiner, não só à viewport.");
  }
  return items;
}

function a11y(input: CreativeInput): string[] {
  const items = [
    "Contraste AA no mínimo; AAA no texto corrido.",
    "Navegação completa por teclado, com foco visível e ordem lógica.",
    "Formulários com label real, erro associado ao campo e mensagem em texto.",
    "Landmarks semânticos (header, nav, main, footer) e skip link.",
    "prefers-reduced-motion desliga o movimento não essencial sem quebrar o conteúdo.",
  ];
  if (input.videoWeight > 0) {
    items.push("Vídeo sem autoplay com som; controle de pausa acessível.");
    items.push("Conteúdo informativo do vídeo também existe em texto.");
  }
  if (input.motion >= 3) {
    items.push("Nenhuma animação pisca mais de 3 vezes por segundo.");
  }
  return items;
}

function conversion(input: CreativeInput): string[] {
  const items = [
    "CTA principal visível na primeira dobra e retomado ao fim, com o mesmo verbo.",
    "Prova social posicionada junto do momento da decisão.",
    "Formulário só com campos que serão realmente usados.",
    "Toda animação tem propósito declarado — nenhuma é decorativa.",
    "Nenhum texto genérico sobrou (inovação, excelência, soluções completas e afins).",
    "Nenhum dado inventado: telefone, endereço, prêmio, número de clientes ou depoimento.",
  ];
  if (input.goal === "whatsapp") {
    items.push("Botão de WhatsApp com mensagem pré-preenchida e número em formato internacional.");
  }
  if (input.goal === "lead") {
    items.push("Formulário com no máximo 4 campos e confirmação clara após o envio.");
  }
  if (input.goal === "agendamento") {
    items.push("CTA de agendamento leva direto ao calendário, sem etapa intermediária.");
  }
  if (input.goal === "venda") {
    items.push("Oferta, preço e política (garantia, prazo, troca) visíveis antes do checkout.");
  }
  if (input.goal === "evento") {
    items.push("Data, horário, local e link de inscrição visíveis sem rolar.");
  }
  return items;
}

function list(title: string, items: string[]): string {
  return [`## ${title}`, "", ...items.map((i) => `- [ ] ${i}`)].join("\n");
}

export function buildChecklists(ctx: DossierContext): string {
  const { input } = ctx;
  const sections = input.sections.length
    ? input.sections.map((s) => findLabel(SECTIONS, s)).join(" → ")
    : "estrutura a definir";

  return [
    "# Checklists de aceite",
    "",
    `Estrutura conferida: ${sections}`,
    "",
    list("UX", ux(input)),
    "",
    list("Performance", performance(input)),
    "",
    list("SEO", seo(input)),
    "",
    list("Responsividade", responsive(input)),
    "",
    list("Acessibilidade", a11y(input)),
    "",
    list("Conversão", conversion(input)),
  ].join("\n");
}
