/**
 * Os pontos de análise que NÃO viram campo de formulário -- a IA deduz do
 * segmento, do briefing e dos concorrentes. No modo grátis este bloco entra no
 * dossiê como instrução ("analise e escreva"); no modo rico ele já vem
 * respondido pela direção criativa e este texto não é usado.
 */

import type { CreativeInput } from "./types";
import { COPY_BANLIST } from "./options";

export const ANALYSIS_POINTS = [
  "**Posicionamento**: onde este negócio está no mercado dele e qual espaço ninguém ocupou.",
  "**Concorrência**: o que os concorrentes citados fazem na comunicação — e o que fazer de diferente (não de melhor).",
  "**Objeções do comprador**: as 3 razões concretas pelas quais alguém desiste antes de converter.",
  "**Tom de comunicação**: como esse público fala e o que soa falso pra ele.",
  "**Personalidade da marca**: 3 adjetivos que a interface precisa provar sem escrever.",
  "**Nível de sofisticação esperado**: quanto de refinamento o ticket médio justifica.",
  "**Dispositivo dominante**: mobile ou desktop, e o que isso muda na hierarquia da primeira dobra.",
  "**Velocidade de internet esperada**: o que precisa funcionar bem em 3G/4G instável.",
  "**Necessidade de SEO**: se a página depende de busca orgânica ou de tráfego pago/direto.",
  "**Necessidade de performance**: o teto realista de peso e o que fica atrás de lazy-load.",
  "**Acessibilidade**: público com necessidades específicas (idade, contexto de uso, leitura em movimento).",
  "**Identidade visual existente**: se há marca consolidada a respeitar ou espaço pra criar do zero.",
];

/** Bloco de instrução usado quando não há direção criativa da IA. */
export function analysisInstructions(input: CreativeInput): string {
  const language = input.contentLanguage.trim() || "Português (Brasil)";
  return [
    "Antes de projetar qualquer coisa, produza a análise abaixo e ESCREVA o resultado.",
    "Não pule esta etapa e não a resuma: é ela que impede o resultado de virar template.",
    "",
    ...ANALYSIS_POINTS.map((p, i) => `${i + 1}. ${p}`),
    "",
    `Escreva a análise em ${language}, de forma específica a este negócio.`,
    "Se um ponto não puder ser deduzido com honestidade dos dados fornecidos, diga o que",
    "assumiu e siga — nunca invente fato verificável (telefone, endereço, prêmio, cliente).",
  ].join("\n");
}

/** Bloco de instrução criativa usado quando não há direção da IA. */
export function creativeInstructions(input: CreativeInput): string {
  const language = input.contentLanguage.trim() || "Português (Brasil)";
  return [
    "Com a análise em mãos, produza a DIREÇÃO CRIATIVA antes de escrever uma linha de código:",
    "",
    "1. **Conceito criativo** — uma ideia central com nome próprio, em uma frase. Não é slogan:",
    "   é a decisão que governa todas as outras. Explique por que ela funciona pra este negócio.",
    "2. **Metáfora condutora** — a imagem que organiza a experiência inteira.",
    "3. **Storytelling em 3 atos** — tensão (o problema que o visitante vive), virada (o que muda",
    "   com este negócio) e resolução (o que ele faz agora). Diga qual seção cobre cada ato.",
    "4. **Direção de arte** — paleta com papel de cada cor (em hex), tipografia display + texto com",
    "   justificativa, texturas/materiais, grid e composição, luz e atmosfera.",
    "5. **Moodboard escrito** — uma referência real por categoria: cinema, fotografia, arquitetura,",
    "   moda, publicidade e branding. Para cada uma, diga exatamente o que extrair (não 'inspirado em X').",
    "6. **Copy** — headline, subheadline e CTA principal.",
    "",
    `Tudo em ${language}. A copy precisa parecer escrita por um copywriter humano:`,
    `nunca use ${COPY_BANLIST.slice(0, 6)
      .map((t) => `"${t}"`)
      .join(", ")} nem construções do mesmo tipo.`,
  ].join("\n");
}
