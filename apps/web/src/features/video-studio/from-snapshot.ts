import type { Box, Snapshot, SnapshotNode, ZoomTarget } from "@millead/video-contracts";

/**
 * Seção real de um site, derivada de um `Snapshot` capturado pelo crawler.
 * Substitui o antigo catálogo fixo de slots: aqui a lista vem do que o site
 * TEM, não de um menu pré-definido.
 */
export interface SnapshotSection {
  nodeId: string;
  sectionId: string;
  label: string;
  screenshot: string | null;
  box: Box;
}

const TETO_ALVOS_DE_ZOOM = 8;
const TAMANHO_MAX_ROTULO = 40;

const TAGS_DE_TITULO = new Set(["h1", "h2", "h3"]);
const TAGS_DE_ACAO = new Set(["button", "a", "form"]);
const TAGS_DE_MIDIA = new Set(["img", "video"]);
const TAGS_ELEGIVEIS = new Set([...TAGS_DE_TITULO, ...TAGS_DE_ACAO, ...TAGS_DE_MIDIA]);

/** Nome legível do tipo de elemento, usado quando não há texto para o rótulo. */
const TIPO_POR_TAG: Record<string, string> = {
  h1: "Título",
  h2: "Título",
  h3: "Título",
  button: "Botão",
  a: "Link",
  form: "Formulário",
  img: "Imagem",
  video: "Vídeo",
};

/**
 * Faixa Unicode dos acentos combinantes (U+0300–U+036F) que sobram depois de
 * `normalize("NFD")` separar letra e acento. Construída a partir do código
 * numérico, não de um literal `̀` no fonte, para não depender de como
 * cada camada (shell, editor, ferramenta) trata escapes de string.
 */
const DIACRITICOS = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

/**
 * Mesmo padrão de slug usado por `slugFor`/`slugUnico` no crawler
 * (apps/runner/src/capture-sections.ts): minúsculas, remoção de diacríticos
 * via NFD, e troca de qualquer sequência não alfanumérica por hífen.
 */
function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICOS, "") // tira acento; regex por code point evita problema de encoding
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function truncar(texto: string, limite: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  const corte = limpo.slice(0, limite);
  const ultimoEspaco = corte.lastIndexOf(" ");
  // Só quebra por palavra se sobrar texto suficiente -- palavra única enorme
  // continua sendo cortada no limite. O espaço antes da reticência separa
  // visualmente a última palavra do corte, em vez de colar "palavra…".
  const base = (ultimoEspaco > limite * 0.6 ? corte.slice(0, ultimoEspaco) : corte).trimEnd();
  return `${base} …`;
}

/**
 * Um nó está "dentro" da seção quando sua caixa cabe verticalmente na caixa
 * da seção, com 1px de folga para arredondamento de sub-pixel medido pelo
 * crawler.
 */
function contidoNaSecao(node: SnapshotNode, secao: SnapshotNode): boolean {
  return (
    node.box.y >= secao.box.y - 1 && node.box.y + node.box.h <= secao.box.y + secao.box.h + 1
  );
}

/** O `h1|h2|h3` de menor `box.y` contido na seção, ou nenhum. */
function primeiroHeading(nodes: SnapshotNode[], secao: SnapshotNode): SnapshotNode | undefined {
  return nodes
    .filter((n) => n.nodeId !== secao.nodeId && TAGS_DE_TITULO.has(n.tag) && contidoNaSecao(n, secao))
    .sort((a, b) => a.box.y - b.box.y)[0];
}

/** Garante `sectionId` único dentro do snapshot, sufixando com o índice em caso de colisão. */
function idUnico(base: string, index: number, usados: Set<string>): string {
  const inicial = base || `secao-${index}`;
  let candidato = inicial;
  let tentativa = index;
  // Laço, não uma tentativa só: o nome sufixado também pode colidir com o id
  // literal de outra seção.
  while (usados.has(candidato)) {
    candidato = `${inicial}-${tentativa}`;
    tentativa += 1;
  }
  usados.add(candidato);
  return candidato;
}

/**
 * Extrai as seções REAIS de um site a partir do `Snapshot` capturado pelo
 * crawler, ordenadas pela posição em que aparecem na página. Substitui o
 * catálogo fixo de 8 slots semânticos: aqui a lista é o que o site tem.
 */
export function sectionsFromSnapshot(snapshot: Snapshot): SnapshotSection[] {
  const secoesBrutas = snapshot.nodes.filter((n) => n.isSection);
  const usados = new Set<string>();

  const secoes = secoesBrutas.map((secao, index) => {
    const heading = primeiroHeading(snapshot.nodes, secao);
    const textoHeading = heading?.text?.trim();
    const base = secao.id ?? (textoHeading ? slugificar(textoHeading) : "");
    const sectionId = idUnico(base, index, usados);

    return {
      nodeId: secao.nodeId,
      sectionId,
      label: textoHeading || sectionId,
      screenshot: secao.screenshot ?? null,
      box: secao.box,
    };
  });

  return secoes.sort((a, b) => a.box.y - b.box.y);
}

function grupoDoAlvo(tag: string): number {
  if (TAGS_DE_TITULO.has(tag)) return 0;
  if (TAGS_DE_ACAO.has(tag)) return 1;
  return 2; // mídia
}

function rotuloDoAlvo(node: SnapshotNode): string {
  const tipo = TIPO_POR_TAG[node.tag] ?? node.tag;
  const texto = node.text?.trim();
  return texto ? `${tipo} "${truncar(texto, TAMANHO_MAX_ROTULO)}"` : tipo;
}

/**
 * Alvos de zoom elegíveis dentro de uma seção: os elementos com que a câmera
 * pode fechar plano durante a renderização do vídeo. Ordenados por
 * relevância (título, depois ação, depois mídia) e limitados a
 * `TETO_ALVOS_DE_ZOOM` para caber na lista de escolha da pessoa.
 */
export function zoomCandidatesFor(snapshot: Snapshot, sectionNodeId: string): ZoomTarget[] {
  const secao = snapshot.nodes.find((n) => n.nodeId === sectionNodeId);
  if (!secao) return [];

  const candidatos = snapshot.nodes.filter((n) => {
    if (n.nodeId === secao.nodeId) return false;
    if (!TAGS_ELEGIVEIS.has(n.tag)) return false;
    if (!n.visible) return false;
    if (n.box.w < 40 || n.box.h < 20) return false;
    if (n.tag === "a" && n.box.h < 32) return false;
    return contidoNaSecao(n, secao);
  });

  const alvos = candidatos.map((n) => ({
    nodeId: n.nodeId,
    label: rotuloDoAlvo(n),
    box: n.box,
    grupo: grupoDoAlvo(n.tag),
  }));

  alvos.sort((a, b) => a.grupo - b.grupo || a.box.y - b.box.y);

  return alvos.slice(0, TETO_ALVOS_DE_ZOOM).map(({ nodeId, label, box }) => ({ nodeId, label, box }));
}
