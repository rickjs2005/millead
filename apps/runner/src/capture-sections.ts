import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SnapshotNode } from "@millead/video-contracts";
import type { Page } from "playwright";

const SETTLE_MS = 250;

/**
 * Elemento com position:fixed/sticky fica grudado na tela enquanto o
 * Playwright rola para fotografar uma seção mais alta que o viewport -- e
 * acaba assado no MEIO da imagem, atravessando o conteúdo. Visto ao vivo em
 * milweb.com.br: a barra de navegação cortava os cards da seção "projects".
 * Neutralizamos durante a captura das seções e restauramos depois; os TILES
 * não passam por aqui, porque neles a barra fixa aparece no topo, que é onde
 * ela realmente está.
 *
 * Duas marretas tentadas e descartadas antes desta, as duas comprovadas ao
 * vivo contra milweb.com.br:
 *
 * 1. `position: static !important` em `*` -- marreta grande demais. Também
 *    derruba `position: absolute`, que sites de verdade usam pra ancorar
 *    conteúdo (badge sobre imagem, texto de hero posicionado no fundo de uma
 *    seção). Empurrou o texto do hero ("top") de ~9% para ~57% da altura da
 *    imagem, porque um bloco `position: absolute` virou bloco normal e
 *    passou a empurrar o resto do fluxo.
 *
 * 2. `position: static !important` só em elementos com `getComputedStyle().
 *    position` igual a `fixed`/`sticky` (marcados via atributo, sem tocar em
 *    absolute/relative) -- parecia a correção cirúrgica certa, mas SÓ trocar
 *    a posição do `<header>` sticky (nada mais) já bastava pra corromper o
 *    hero da seção "top": o texto do eyebrow ficava esborrachado por cima do
 *    título, mesmo o header não sendo ancestral nem descendente de "top".
 *    Confirmado isolando cada elemento marcado um de cada vez -- não é
 *    stitching (a seção "top" cabe inteira num viewport, 995px), é algum
 *    observer/listener da página reagindo à MUDANÇA DE POSIÇÃO do header e
 *    reiniciando a animação de entrada do hero, capturada pela metade.
 *
 * A correção que ficou: em vez de tirar o elemento da posição fixa/sticky,
 * só o escondemos (`visibility: hidden`), sem tocar em `position` nenhuma.
 * Isso não mexe no fluxo/layout de mais ninguém (fixed já não reservava
 * espaço; sticky continua reservando o mesmo espaço de sempre, só que
 * invisível) e não dispara o que quer que estivesse re-triggerando a
 * animação do hero. Testado ao vivo: "raio-x" (a barra some do meio da
 * imagem) e "top" (hero volta a renderizar limpo) ficam os dois corretos.
 */
const ATRIBUTO_GRUDENTO = "data-millead-desgrudar";

const CSS_SEM_FIXOS = `
  [${ATRIBUTO_GRUDENTO}] {
    visibility: hidden !important;
  }
`;

/** Carimba com `ATRIBUTO_GRUDENTO` todo elemento fixed/sticky, sem tocar em absolute/relative. */
async function marcarElementosGrudentos(page: Page): Promise<void> {
  await page.evaluate((attr) => {
    document.querySelectorAll("*").forEach((el) => {
      const { position } = getComputedStyle(el);
      if (position === "fixed" || position === "sticky") {
        el.setAttribute(attr, "");
      }
    });
  }, ATRIBUTO_GRUDENTO);
}

/** Remove os carimbos deixados por `marcarElementosGrudentos`. */
async function desmarcarElementosGrudentos(page: Page): Promise<void> {
  await page.evaluate((attr) => {
    document.querySelectorAll(`[${attr}]`).forEach((el) => el.removeAttribute(attr));
  }, ATRIBUTO_GRUDENTO);
}

function slugFor(node: SnapshotNode, index: number): string {
  const base = node.id ?? `${node.tag}-${index}`;
  return base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // tira acento; escape explícito evita problema de encoding
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Nome de arquivo único dentro de uma captura. Sem isto, ids que normalizam
 * para o mesmo slug (ex.: "Preço" e "Preco" acentuado, ou "hero-1" e
 * "hero_1") gravam no mesmo arquivo -- a segunda seção sobrescreve a
 * primeira e o schema valida as duas, então o erro passa em silêncio.
 */
function slugUnico(node: SnapshotNode, index: number, usados: Set<string>): string {
  const base = slugFor(node, index) || `secao-${index}`;
  const nome = usados.has(base) ? `${base}-${index}` : base;
  usados.add(nome);
  return nome;
}

/**
 * Fotografa cada seção a partir do próprio elemento (scroll into view + settle),
 * nunca recortando o tile: elemento que atravessa a fronteira de dois tiles
 * sairia cortado.
 */
export async function captureSections(
  page: Page,
  nodes: SnapshotNode[],
  outDir: string,
): Promise<SnapshotNode[]> {
  await mkdir(join(outDir, "sections"), { recursive: true });
  const result: SnapshotNode[] = [];
  const usados = new Set<string>();

  await marcarElementosGrudentos(page);
  const styleHandle = await page.addStyleTag({ content: CSS_SEM_FIXOS });
  try {
    for (const [index, node] of nodes.entries()) {
      if (!node.isSection) {
        result.push(node);
        continue;
      }

      const file = `sections/${slugUnico(node, index, usados)}.jpg`;
      const locator = page.locator(node.selector).first();
      try {
        await locator.scrollIntoViewIfNeeded({ timeout: 5_000 });
        await page.waitForTimeout(SETTLE_MS);
        await locator.screenshot({ path: join(outDir, file), type: "jpeg", quality: 90 });
        result.push({ ...node, screenshot: file });
      } catch {
        // Seletor frágil ou elemento fora de alcance: degrada para nó comum em
        // vez de derrubar a captura inteira. O schema exige screenshot em seção,
        // então o nó deixa de ser seção.
        result.push({ ...node, isSection: false });
      }
    }
  } finally {
    // A mesma `page` segue viva para o capturePage depois -- sem desfazer a
    // tag e os carimbos, a página inteira ficaria com o header (e outros
    // elementos fixed/sticky) escondidos mesmo fora da captura de seções.
    await styleHandle.evaluate((el) => (el as Element).remove());
    await desmarcarElementosGrudentos(page);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return result;
}
