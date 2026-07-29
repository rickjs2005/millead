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

/** Uma seção casa com um `want` se o campo indicado (normalizado) contiver alguma palavra-chave. */
function secaoCasaPorCampo(secao: SnapshotSection, palavras: string[], campo: "sectionId" | "label"): boolean {
  const alvo = normalizar(secao[campo]);
  return palavras.some((palavra) => alvo.includes(normalizar(palavra)));
}

function construirCenaDeSite(want: PromptTemplate["wants"][number], secao: SnapshotSection): SiteFormScene {
  return {
    id: idDaCena(want.chave),
    kind: "site",
    enabled: true,
    durationSec: want.durationSec,
    sectionId: secao.sectionId,
    label: secao.label,
    screenshot: secao.screenshot,
    sourceNodeId: secao.nodeId,
    zoomTargets: [],
  };
}

/**
 * Casa os `wants` do template com as seções REAIS do site (derivadas do
 * Snapshot por `sectionsFromSnapshot`). O template deixou de ditar a lista de
 * cenas: agora ele sugere o que gostaria de mostrar, e esta função relata em
 * `naoEncontrados` o que o site não tem.
 *
 * Regra de casamento: substring, em DUAS passadas -- id vence prosa.
 * `sectionId` é o nome que o autor do site deu à seção (intenção declarada);
 * `label` é o texto do heading (prosa de marketing, que gera falso positivo:
 * um `want` de "Produtos" casaria por engano com uma seção de contato cujo
 * título diz "...um produto digital?"). Por isso a primeira passada só olha
 * `sectionId`, para todos os `wants` na ordem do template; só os que sobram
 * sem par tentam de novo na segunda passada, agora por `label`, contra as
 * seções que ainda sobraram livres. Nunca reusa a mesma seção em duas cenas,
 * nunca inventa uma seção que o site não tem. As cenas de estúdio (que não
 * dependem do site) entram intactas nas posições que já tinham, definidas
 * por `siteInsertAt`.
 */
export function matchTemplate(template: PromptTemplate, secoes: SnapshotSection[]): MatchResult {
  const usados = new Set<string>();
  const cenasPorChave = new Map<string, SiteFormScene>();
  let pendentes = template.wants;

  for (const campo of ["sectionId", "label"] as const) {
    const aindaPendentes: typeof template.wants = [];

    for (const want of pendentes) {
      const secao = secoes.find((s) => !usados.has(s.sectionId) && secaoCasaPorCampo(s, want.palavras, campo));

      if (!secao) {
        aindaPendentes.push(want);
        continue;
      }

      usados.add(secao.sectionId);
      cenasPorChave.set(want.chave, construirCenaDeSite(want, secao));
    }

    pendentes = aindaPendentes;
  }

  const naoEncontrados = pendentes.map((want) => want.chave);
  // Preserva a ordem original dos `wants`, não a ordem em que cada passada casou.
  const cenasDeSite = template.wants
    .map((want) => cenasPorChave.get(want.chave))
    .filter((cena): cena is SiteFormScene => cena !== undefined);

  const antes = template.defaultScenes.slice(0, template.siteInsertAt);
  const depois = template.defaultScenes.slice(template.siteInsertAt);

  return {
    scenes: [...antes, ...cenasDeSite, ...depois],
    naoEncontrados,
  };
}
