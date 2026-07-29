import type { SnapshotSection } from "./from-snapshot";
import type { FormScene, PromptTemplate, SiteFormScene } from "./types";

/**
 * Faixa Unicode dos acentos combinantes (U+0300–U+036F) que sobram depois de
 * `normalize("NFD")` separar letra e acento -- mesmo truque usado em
 * `from-snapshot.ts` para não depender de um literal `̀` no fonte.
 */
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
}

function idDaCena(chave: string): string {
  const slug = normalizar(chave)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `site-${slug || "cena"}`;
}

export interface MatchResult {
  /** Timeline final: cenas de estúdio nas posições originais + cenas de site casadas. */
  scenes: FormScene[];
  /** `chave` de cada `want` do template que nenhuma seção do site atendeu. */
  naoEncontrados: string[];
}

/** Uma seção casa com um `want` se seu id ou rótulo (normalizados) contiver alguma palavra-chave. */
function secaoCasaComWant(secao: SnapshotSection, palavras: string[]): boolean {
  const alvo = `${normalizar(secao.sectionId)} ${normalizar(secao.label)}`;
  return palavras.some((palavra) => alvo.includes(normalizar(palavra)));
}

/**
 * Casa os `wants` do template com as seções REAIS do site (derivadas do
 * Snapshot por `sectionsFromSnapshot`). O template deixou de ditar a lista de
 * cenas: agora ele sugere o que gostaria de mostrar, e esta função relata em
 * `naoEncontrados` o que o site não tem.
 *
 * Regra de casamento: substring, primeira seção ainda não usada que casar
 * vence -- nunca reusa a mesma seção em duas cenas, e nunca inventa uma
 * seção que o site não tem. As cenas de estúdio (que não dependem do site)
 * entram intactas nas posições que já tinham, definidas por `siteInsertAt`.
 */
export function matchTemplate(template: PromptTemplate, secoes: SnapshotSection[]): MatchResult {
  const usados = new Set<string>();
  const naoEncontrados: string[] = [];
  const cenasDeSite: SiteFormScene[] = [];

  for (const want of template.wants) {
    const secao = secoes.find((s) => !usados.has(s.sectionId) && secaoCasaComWant(s, want.palavras));

    if (!secao) {
      naoEncontrados.push(want.chave);
      continue;
    }

    usados.add(secao.sectionId);
    cenasDeSite.push({
      id: idDaCena(want.chave),
      kind: "site",
      enabled: true,
      durationSec: want.durationSec,
      sectionId: secao.sectionId,
      label: secao.label,
      screenshot: secao.screenshot,
      sourceNodeId: secao.nodeId,
      zoomTargets: [],
    });
  }

  const antes = template.defaultScenes.slice(0, template.siteInsertAt);
  const depois = template.defaultScenes.slice(template.siteInsertAt);

  return {
    scenes: [...antes, ...cenasDeSite, ...depois],
    naoEncontrados,
  };
}
