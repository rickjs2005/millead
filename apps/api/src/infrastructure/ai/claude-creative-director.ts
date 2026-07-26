import Anthropic from "@anthropic-ai/sdk";
import type {
  CreativeBrief,
  CreativeDirection,
  CreativeDirector,
} from "../../domain/services/creative-director.js";

/** Objeto do schema com todas as chaves obrigatórias (exigência do structured output). */
function obj(properties: Record<string, unknown>) {
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

const str = { type: "string" } as const;
const strArray = { type: "array", items: str } as const;

const DIRECTION_SCHEMA = obj({
  analise: obj({
    posicionamento: str,
    tomDeVoz: str,
    dispositivoDominante: str,
    nivelSeo: str,
    objecoes: strArray,
  }),
  conceito: obj({
    nome: str,
    ideiaCentral: str,
    metafora: str,
    emocaoAlvo: str,
    porqueFunciona: str,
  }),
  narrativa: obj({ ato1: str, ato2: str, ato3: str, fioCondutor: str }),
  direcaoDeArte: obj({
    paleta: { type: "array", items: obj({ hex: str, papel: str }) },
    tipografia: obj({ display: str, texto: str, porque: str }),
    texturas: str,
    grid: str,
    luz: str,
  }),
  moodboard: {
    type: "array",
    items: obj({ categoria: str, referencia: str, oQueExtrair: str }),
  },
  wireframe: {
    type: "array",
    items: obj({
      secao: str,
      objetivo: str,
      objecaoQueResponde: str,
      conteudo: str,
      animacao: str,
      temVideo: { type: "boolean" },
    }),
  },
  cenas: {
    type: "array",
    items: obj({
      ordem: { type: "integer" },
      secaoDoSite: str,
      descricao: str,
      movimentoDeCamera: str,
      plano: str,
      iluminacao: str,
      paletaCinematografica: str,
      duracaoSeg: { type: "integer" },
      integracaoComScroll: str,
      primeiroFrame: str,
      ultimoFrame: str,
    }),
  },
  stills: {
    type: "array",
    items: obj({ uso: str, descricao: str, camera: str, lente: str, luz: str, composicao: str }),
  },
  copy: obj({
    headline: str,
    subheadline: str,
    ctaPrincipal: str,
    ctasSecundarios: strArray,
  }),
  extras: strArray,
});

const SYSTEM = [
  "Você é diretor criativo, diretor de arte, UX designer, motion designer e diretor de fotografia.",
  "Trabalha no padrão de estúdios como Locomotive, Dogstudio, Active Theory, Resn, Basic Agency,",
  "Fantasy, Instrument, Build in Amsterdam e dos vencedores do FWA e do Awwwards Site of the Day.",
  "",
  "Sua tarefa é produzir a DIREÇÃO CRIATIVA de uma landing page — não o código dela.",
  "",
  "Regras inegociáveis:",
  "- Nada pode servir a outro negócio. Se a direção continuar fazendo sentido trocando o logo,",
  "  ela está errada. Cada decisão precisa nascer deste segmento, deste público e deste ticket.",
  "- Nada pode parecer gerado por IA: sem estética média, sem gradiente roxo, sem glassmorphism",
  "  gratuito, sem Corporate Memphis, sem fontes de sistema como escolha tipográfica.",
  "- O conceito criativo tem nome próprio e uma ideia central em uma frase — não é slogan,",
  "  é a decisão que governa todas as outras.",
  "- Referências de moodboard são obras/marcas REAIS e existentes, com o que extrair de cada uma.",
  "  Nunca invente um filme, um fotógrafo ou uma campanha.",
  "- Copy escrita por gente: proibido 'inovação', 'excelência', 'soluções completas',",
  "  'transformando sonhos', 'sua melhor escolha' e construções do mesmo tipo.",
  "- Nunca invente fato verificável do negócio: telefone, endereço, prêmio, número de clientes",
  "  ou depoimento com nome de pessoa real. Use apenas o que foi fornecido.",
  "- As cenas de vídeo existem para a experiência do site: cada uma declara em qual seção vive,",
  "  como o scroll a dirige, e descreve o primeiro e o último frame com precisão suficiente",
  "  para que a cena seguinte continue exatamente de onde ela parou.",
  "- O wireframe cobre as seções pedidas, na ordem pedida, e cada seção derruba uma objeção real.",
].join("\n");

function renderBrief(b: CreativeBrief): string {
  const lines = [
    `Negócio: ${b.businessName || "(não informado)"}`,
    b.segment && `Segmento: ${b.segment}`,
    b.description && `O que faz/oferece: ${b.description}`,
    b.audience && `Público-alvo: ${b.audience}`,
    b.differentials && `Diferenciais: ${b.differentials}`,
    b.competitors && `Concorrentes diretos: ${b.competitors}`,
    b.averageTicket && `Ticket médio: ${b.averageTicket}`,
    b.location && `Localização: ${b.location}`,
    b.contact && `Contato: ${b.contact}`,
    "",
    `Objetivo comercial: ${b.goal}`,
    `Emoção-alvo: ${b.emotion}`,
    `Arquétipo de marca: ${b.archetype}`,
    `Idioma do conteúdo: ${b.contentLanguage}`,
    "",
    `Nível de luxo: ${b.luxury}`,
    `Ousadia criativa permitida: ${b.boldness}`,
    `Densidade de animação: ${b.motion}`,
    `Peso do vídeo: ${b.videoWeight}`,
    "",
    `Linguagem visual pedida: ${b.designStyle}`,
    b.palette && `Paleta pedida: ${b.palette}`,
    b.references && `Referências do cliente: ${b.references}`,
    "",
    `Stack: ${b.stack}`,
    b.sections.length ? `Seções (nesta ordem): ${b.sections.join(" → ")}` : null,
    b.notes && `\nObservações do vendedor e respostas do briefing:\n${b.notes}`,
  ].filter(Boolean);

  const cenas =
    b.sceneCount > 0
      ? `Produza exatamente ${b.sceneCount} cenas de vídeo, na ordem em que aparecem no site.`
      : "Este projeto NÃO usa vídeo: devolva a lista de cenas vazia.";

  return [
    lines.join("\n"),
    "",
    "---",
    "",
    cenas,
    "Produza de 4 a 8 stills (hero, imagem de compartilhamento, apoio de seção e texturas).",
    "Produza 6 referências de moodboard, uma por categoria: cinema, fotografia, arquitetura,",
    "moda, publicidade e branding.",
    "Produza de 3 a 6 sugestões extras capazes de elevar o projeto ao nível de um vencedor do Awwwards.",
    `Escreva tudo em ${b.contentLanguage}.`,
  ].join("\n");
}

export class ClaudeCreativeDirector implements CreativeDirector {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    // Direção criativa é uma geração longa (thinking + JSON grande) -- timeout folgado.
    this.client = new Anthropic({ apiKey, timeout: 10 * 60 * 1000 });
  }

  async direct(brief: CreativeBrief): Promise<CreativeDirection> {
    // Streaming obrigatório: max_tokens alto sem stream estoura o timeout HTTP.
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 32000,
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: DIRECTION_SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: "user", content: renderBrief(brief) }],
    } as Anthropic.MessageStreamParams);

    const response = await stream.finalMessage();

    if (response.stop_reason === "refusal") {
      throw new Error("A IA recusou gerar a direção criativa para este briefing.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error(
        "A direção criativa ficou grande demais e foi cortada -- reduza o número de seções ou de cenas.",
      );
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    try {
      // O structured output garante o formato; o parse só materializa o objeto.
      return JSON.parse(text) as CreativeDirection;
    } catch {
      throw new Error("A IA não devolveu uma direção criativa válida.");
    }
  }
}
