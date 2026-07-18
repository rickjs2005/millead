import {
  ANIMATIONS,
  DESIGN_STYLES,
  FRAMEWORKS,
  GOALS,
  LANGUAGES,
  SECTIONS,
  findGuidance,
  findLabel,
} from "./options";

export interface PromptInput {
  // Negócio
  businessName: string;
  segment: string;
  description: string;
  audience: string;
  differentials: string;
  location: string;
  contact: string;
  // Objetivo / conteúdo
  goal: string;
  contentLanguage: string; // idioma do CONTEÚDO (ex.: "Português (Brasil)")
  // Design
  designStyle: string;
  palette: string;
  references: string;
  // Técnico
  framework: string;
  language: string; // linguagem de programação (typescript/javascript)
  animation: string;
  // Seções (values de SECTIONS, na ordem escolhida)
  sections: string[];
  // Extra
  notes: string;
}

function line(label: string, value: string): string | null {
  const v = value.trim();
  return v ? `- ${label}: ${v}` : null;
}

/**
 * Compõe o prompt final (pt-BR) pronto pra colar no ChatGPT/Claude. É
 * determinístico -- pura composição de template a partir dos inputs, sem
 * chamar IA. O prompt é escrito na 2ª pessoa ("Você é..."), estruturado em
 * seções que a IA consegue seguir, e adapta o formato de entrega ao
 * framework escolhido.
 */
export function buildPrompt(input: PromptInput): string {
  const styleGuide = findGuidance(DESIGN_STYLES, input.designStyle);
  const frameworkGuide = findGuidance(FRAMEWORKS, input.framework);
  const langGuide = findGuidance(LANGUAGES, input.language);
  const animGuide = findGuidance(ANIMATIONS, input.animation);
  const goalGuide = findGuidance(GOALS, input.goal);

  const isSingleFile = input.framework === "html-css" || input.framework === "html-tailwind";
  const contentLang = input.contentLanguage.trim() || "Português (Brasil)";

  const negocio = [
    line("Nome", input.businessName),
    line("Segmento", input.segment),
    line("O que faz / oferece", input.description),
    line("Público-alvo", input.audience),
    line("Diferenciais", input.differentials),
    line("Localização", input.location),
    line("Contato", input.contact),
  ]
    .filter(Boolean)
    .join("\n");

  const design = [
    `- Estilo: ${findLabel(DESIGN_STYLES, input.designStyle)} — ${styleGuide}`,
    line("Paleta / cores", input.palette),
    line("Referências", input.references),
  ]
    .filter(Boolean)
    .join("\n");

  const stack = [
    `- Framework/biblioteca: ${findLabel(FRAMEWORKS, input.framework)} — ${frameworkGuide}`,
    `- Linguagem: ${findLabel(LANGUAGES, input.language)} — ${langGuide}`,
    `- Animações: ${findLabel(ANIMATIONS, input.animation)} — ${animGuide}`,
    "- 100% responsivo (mobile-first), acessível (semântica, contraste, foco visível) e com SEO básico (title, meta description, tags Open Graph).",
  ].join("\n");

  const secoes =
    input.sections.length > 0
      ? input.sections
          .map((s, i) => `${i + 1}. ${findLabel(SECTIONS, s)} — ${findGuidance(SECTIONS, s)}`)
          .join("\n")
      : "Você decide as seções mais adequadas ao objetivo.";

  const entrega = isSingleFile
    ? "Entregue o código COMPLETO em um único arquivo, pronto pra copiar, salvar como .html e abrir no navegador. Sem placeholders do tipo 'insira aqui' — preencha com conteúdo real e coerente."
    : "Entregue o código COMPLETO e organizado (um componente por seção), indicando o caminho de cada arquivo. Sem placeholders — preencha com conteúdo real e coerente. Se faltar imagem, use um placeholder de cor sólida ou de um serviço de placeholder, nunca deixe quebrado.";

  const extras = input.notes.trim() ? `\n## Observações adicionais\n${input.notes.trim()}\n` : "";

  return `Você é um designer e desenvolvedor front-end sênior, premiado (Awwwards). Crie uma landing page de alta conversão e visualmente impecável para o negócio abaixo.

## Contexto do negócio
${negocio || "- (preencher os dados do negócio)"}

## Objetivo da página
${goalGuide || "converter o visitante."} A chamada para ação (CTA) principal deve refletir esse objetivo e aparecer com destaque no hero e ao fim da página.

## Identidade visual
${design}

## Stack técnica
${stack}

## Seções (nesta ordem)
${secoes}

## Requisitos de qualidade
- Copy persuasiva e específica em ${contentLang}, escrita para converter — NADA de "lorem ipsum" nem texto genérico.
- Hierarquia visual clara, espaçamento generoso e consistente, tipografia com escala bem definida.
- Contraste e legibilidade adequados; estados de hover/foco nos elementos interativos.
- Performance: imagens otimizadas, sem dependências desnecessárias.
- O resultado deve parecer feito por um estúdio de design premium, não um template.

## Formato de entrega
${entrega}
${extras}
Antes de começar, se algum dado essencial estiver faltando, faça no máximo 2 perguntas objetivas; caso contrário, gere direto.`;
}
