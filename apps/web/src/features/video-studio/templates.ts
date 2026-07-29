import type { PromptTemplate, StudioFormScene } from "./types";

function studio(
  id: string,
  component: StudioFormScene["component"],
  durationSec: number,
  zoomTargets: string[] = [],
): StudioFormScene {
  return { id, kind: "studio", component, enabled: true, durationSec, zoomTargets };
}

/**
 * Corpo comum dos cinco templates. O que muda entre eles é o parágrafo de
 * abertura e a sequência padrão de cenas -- as regras da narração são as
 * mesmas, e nenhuma instrução do usuário pode removê-las (ver buildPrompt).
 */
function body(abertura: string): string {
  return [
    abertura,
    "",
    "Empresa: {{empresa}}",
    "Site: {{url}}",
    "Formato: {{formato}} — {{duracao}} segundos",
    "",
    "O vídeo é uma GRAVAÇÃO DE TELA já definida. A timeline abaixo está fechada;",
    "você não a altera. Cada cena traz seu orçamento de palavras.",
    "",
    "{{cenas}}",
    "",
    "ANTES de narrar, se a ordem ou as durações prejudicarem o vídeo, diga em até",
    "três frases. Se estiver bom, não invente crítica.",
    "",
    "{{blocoNarracao}}",
    "",
    "Regras da narração:",
    "- Português do Brasil, frases curtas, linguagem comercial, sem jargão.",
    "- Respeite o orçamento de palavras de cada cena. Total: {{orcamentoPalavras}} palavras.",
    "- Cena pode ficar em silêncio se o texto não acrescentar nada.",
    "- Nunca invente fato do negócio: prêmio, número de clientes, telefone ou endereço.",
    "- Termine convidando a acessar o site.",
    "",
    "Responda em JSON:",
    '{ "criticas": [], "narracao": [ { "sceneId": "...", "texto": "...", "legenda": "..." } ] }',
  ].join("\n");
}

export const TEMPLATES: PromptTemplate[] = [
  {
    id: "institucional",
    name: "Institucional",
    description: "Apresenta a empresa, o que ela faz e como falar com ela.",
    defaultScenes: [
      studio("sc1", "notebook", 3),
      studio("sc2", "google", 5, ["barra", "resultado"]),
      studio("sc7", "whatsapp", 2, ["mensagem"]),
    ],
    siteInsertAt: 2,
    wants: [
      { chave: "Hero", palavras: ["top", "hero", "inicio", "home"], durationSec: 6 },
      { chave: "Sobre", palavras: ["about", "sobre", "quem"], durationSec: 5 },
      {
        chave: "Serviços",
        palavras: ["servic", "services", "deliverable", "entrego", "solucao"],
        durationSec: 6,
      },
      { chave: "Contato", palavras: ["contact", "contato", "formulario", "fale"], durationSec: 3 },
    ],
    body: body("Você escreve narração para vídeos institucionais curtos de divulgação de sites."),
  },
  {
    id: "lancamento",
    name: "Lançamento de Site",
    description: "Anuncia que o site novo está no ar, começando pela busca no Google.",
    defaultScenes: [
      studio("sc1", "notebook", 3),
      studio("sc2", "google", 6, ["barra", "resultado", "url"]),
      studio("sc5", "whatsapp", 4, ["mensagem"]),
      studio("sc6", "logo", 3),
    ],
    siteInsertAt: 2,
    wants: [
      { chave: "Hero", palavras: ["top", "hero", "inicio", "home", "lancamento"], durationSec: 8 },
      {
        chave: "Produtos",
        palavras: ["produt", "product", "cards", "vitrine", "catalogo"],
        durationSec: 6,
      },
    ],
    body: body("Você escreve narração para vídeos que anunciam o lançamento do site novo de uma empresa."),
  },
  {
    id: "portfolio",
    name: "Portfólio",
    description: "Percorre trabalhos e diferenciais, terminando em contato.",
    defaultScenes: [studio("sc6", "logo", 3)],
    siteInsertAt: 0,
    wants: [
      { chave: "Hero", palavras: ["top", "hero", "inicio", "home", "capa"], durationSec: 6 },
      {
        chave: "Serviços",
        palavras: ["servic", "services", "deliverable", "entrego", "solucao"],
        durationSec: 8,
      },
      {
        chave: "Produtos",
        palavras: ["produt", "product", "cards", "trabalho", "projeto", "portfolio"],
        durationSec: 15,
      },
      {
        chave: "Depoimentos",
        palavras: ["depoimento", "testemunho", "avaliacao", "review"],
        durationSec: 8,
      },
      { chave: "Contato", palavras: ["contact", "contato", "formulario", "fale", "orcamento"], durationSec: 5 },
    ],
    body: body("Você escreve narração para vídeos de portfólio, que mostram trabalhos entregues."),
  },
  {
    id: "loja",
    name: "Loja Virtual",
    description: "Destaca categorias e produtos, terminando no atendimento.",
    defaultScenes: [
      studio("sc1", "google", 5, ["barra", "resultado"]),
      studio("sc5", "whatsapp", 6, ["conversa"]),
      studio("sc6", "logo", 4),
    ],
    siteInsertAt: 1,
    wants: [
      { chave: "Hero", palavras: ["top", "hero", "inicio", "home", "loja"], durationSec: 6 },
      {
        chave: "Produtos",
        palavras: ["produt", "product", "cards", "preco", "comprar", "loja"],
        durationSec: 18,
      },
      {
        chave: "Contato",
        palavras: ["contact", "contato", "formulario", "comprar", "checkout"],
        durationSec: 6,
      },
    ],
    body: body("Você escreve narração para vídeos de loja virtual, focados em produto e compra."),
  },
  {
    id: "captacao",
    name: "Captação de Leads",
    description: "Foca no formulário e na chegada da mensagem no WhatsApp.",
    defaultScenes: [studio("sc4", "whatsapp", 5, ["mensagem"]), studio("sc5", "logo", 3)],
    siteInsertAt: 0,
    wants: [
      { chave: "Hero", palavras: ["top", "hero", "inicio", "home"], durationSec: 6 },
      {
        chave: "Serviços",
        palavras: ["servic", "services", "deliverable", "entrego", "solucao"],
        durationSec: 6,
      },
      {
        chave: "Contato",
        palavras: ["contact", "contato", "formulario", "fale", "cadastr", "lead"],
        durationSec: 10,
      },
    ],
    body: body("Você escreve narração para vídeos de captação de leads, que levam ao formulário."),
  },
];

export function templateById(id: string): PromptTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
