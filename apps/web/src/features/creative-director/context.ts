/**
 * Blocos de texto compartilhados pelos artefatos: dados do negócio, escolhas
 * do formulário e a direção criativa já materializada. Todos devolvem markdown
 * pronto pra ser embutido em qualquer aba.
 */

import type { CreativeDirection, CreativeInput } from "./types";
import {
  ANIMATIONS,
  ARCHETYPES,
  DESIGN_STYLES,
  EFFECTS,
  EMOTIONS,
  FRAMEWORKS,
  GOALS,
  LANGUAGES,
  SCALES,
  SECTIONS,
  findGuidance,
  findLabel,
  findOption,
  scaleLevel,
} from "./options";

export function line(label: string, value: string): string | null {
  const v = value.trim();
  return v ? `- ${label}: ${v}` : null;
}

/** Dados crus do negócio. */
export function businessBlock(input: CreativeInput): string {
  const lines = [
    line("Nome", input.businessName),
    line("Segmento", input.segment),
    line("O que faz / oferece", input.description),
    line("Público-alvo", input.audience),
    line("Diferenciais", input.differentials),
    line("Concorrentes diretos", input.competitors),
    line("Ticket médio", input.averageTicket),
    line("Localização", input.location),
    line("Contato", input.contact),
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : "- (dados do negócio não preenchidos)";
}

/** Emoção, arquétipo, objetivo e os quatro sliders. */
export function positioningBlock(input: CreativeInput): string {
  const scales = SCALES.map(
    (s) => `- ${s.label} (${input[s.key]}/4): ${scaleLevel(s, input[s.key])}`,
  ).join("\n");
  return [
    `- Objetivo comercial: ${findGuidance(GOALS, input.goal) || "converter o visitante."}`,
    `- Emoção-alvo: ${findLabel(EMOTIONS, input.emotion)} — ${findGuidance(EMOTIONS, input.emotion)}`,
    `- Arquétipo de marca: ${findLabel(ARCHETYPES, input.archetype)} — ${findGuidance(ARCHETYPES, input.archetype)}`,
    `- Idioma do conteúdo: ${contentLanguage(input)}`,
    scales,
  ].join("\n");
}

export function contentLanguage(input: CreativeInput): string {
  return input.contentLanguage.trim() || "Português (Brasil)";
}

/** Estilo visual escolhido + referências (as digitadas e as do estilo). */
export function visualBlock(input: CreativeInput): string {
  const style = findOption(DESIGN_STYLES, input.designStyle);
  const styleRef = style?.reference ? `inspiração visual: ${style.reference}` : "";
  const refs = [input.references.trim(), styleRef].filter(Boolean).join("; ");
  return [
    `- Linguagem visual: ${style?.label ?? input.designStyle} — ${style?.guidance ?? ""}`,
    line("Paleta / cores", input.palette),
    refs ? `- Referências: ${refs}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Stack, linguagem, animação e recursos avançados. */
export function stackBlock(input: CreativeInput): string {
  const effects = input.effects
    .map((e) => `  - ${findLabel(EFFECTS, e)}: ${findGuidance(EFFECTS, e)}`)
    .join("\n");
  return [
    `- Framework: ${findLabel(FRAMEWORKS, input.framework)} — ${findGuidance(FRAMEWORKS, input.framework)}`,
    `- Linguagem: ${findLabel(LANGUAGES, input.language)} — ${findGuidance(LANGUAGES, input.language)}`,
    `- Animação base: ${findLabel(ANIMATIONS, input.animation)} — ${findGuidance(ANIMATIONS, input.animation)}`,
    effects ? `- Recursos avançados obrigatórios:\n${effects}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Seções escolhidas, na ordem, com o propósito de cada uma. */
export function sectionsBlock(input: CreativeInput): string {
  if (input.sections.length === 0) {
    return "Você decide as seções — justifique a estrutura a partir da narrativa e das objeções do comprador.";
  }
  return input.sections
    .map((s, i) => `${i + 1}. ${findLabel(SECTIONS, s)} — ${findGuidance(SECTIONS, s)}`)
    .join("\n");
}

/** True quando o projeto entrega um único arquivo HTML. */
export function isSingleFile(input: CreativeInput): boolean {
  return input.framework === "html-css" || input.framework === "html-tailwind";
}

/** Observações digitadas pelo vendedor (inclui o que veio do briefing). */
export function notesBlock(input: CreativeInput): string {
  return input.notes.trim();
}

// ---------------------------------------------------------------------------
// Direção criativa materializada (modo rico)
// ---------------------------------------------------------------------------

export function conceptBlock(d: CreativeDirection): string {
  return [
    `**${d.conceito.nome}**`,
    "",
    d.conceito.ideiaCentral,
    "",
    `- Metáfora condutora: ${d.conceito.metafora}`,
    `- Emoção-alvo: ${d.conceito.emocaoAlvo}`,
    `- Por que funciona pra este negócio: ${d.conceito.porqueFunciona}`,
  ].join("\n");
}

export function narrativeBlock(d: CreativeDirection): string {
  return [
    `- Fio condutor: ${d.narrativa.fioCondutor}`,
    `1. **Ato 1 — tensão**: ${d.narrativa.ato1}`,
    `2. **Ato 2 — virada**: ${d.narrativa.ato2}`,
    `3. **Ato 3 — resolução**: ${d.narrativa.ato3}`,
  ].join("\n");
}

export function artDirectionBlock(d: CreativeDirection): string {
  const paleta = d.direcaoDeArte.paleta.map((c) => `  - \`${c.hex}\` — ${c.papel}`).join("\n");
  return [
    "- Paleta:",
    paleta,
    `- Tipografia: display **${d.direcaoDeArte.tipografia.display}**, texto **${d.direcaoDeArte.tipografia.texto}** — ${d.direcaoDeArte.tipografia.porque}`,
    `- Texturas e materiais: ${d.direcaoDeArte.texturas}`,
    `- Grid e composição: ${d.direcaoDeArte.grid}`,
    `- Luz e atmosfera: ${d.direcaoDeArte.luz}`,
  ].join("\n");
}

export function moodboardBlock(d: CreativeDirection): string {
  return d.moodboard
    .map((m) => `- **${m.categoria}** · ${m.referencia} → ${m.oQueExtrair}`)
    .join("\n");
}

export function wireframeBlock(d: CreativeDirection): string {
  return d.wireframe
    .map((s, i) =>
      [
        `${i + 1}. **${s.secao}**${s.temVideo ? " · com vídeo" : ""}`,
        `   - Objetivo: ${s.objetivo}`,
        `   - Objeção que responde: ${s.objecaoQueResponde}`,
        `   - Conteúdo: ${s.conteudo}`,
        `   - Animação: ${s.animacao}`,
      ].join("\n"),
    )
    .join("\n");
}

export function analysisBlock(d: CreativeDirection): string {
  return [
    `- Posicionamento: ${d.analise.posicionamento}`,
    `- Tom de voz: ${d.analise.tomDeVoz}`,
    `- Dispositivo dominante: ${d.analise.dispositivoDominante}`,
    `- Necessidade de SEO: ${d.analise.nivelSeo}`,
    "- Objeções do comprador:",
    ...d.analise.objecoes.map((o) => `  - ${o}`),
  ].join("\n");
}

export function copyBlock(d: CreativeDirection): string {
  return [
    `- Headline: **${d.copy.headline}**`,
    `- Subheadline: ${d.copy.subheadline}`,
    `- CTA principal: **${d.copy.ctaPrincipal}**`,
    d.copy.ctasSecundarios.length
      ? `- CTAs secundários: ${d.copy.ctasSecundarios.join(" · ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}
