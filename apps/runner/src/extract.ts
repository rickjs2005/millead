import type { SnapshotNode } from "@millead/video-contracts";
import type { Page } from "playwright";
import { fingerprint } from "./fingerprint.js";

const MIN_SECTION_HEIGHT = 200;
const SECTION_TAGS = new Set(["section", "header", "footer", "article", "main"]);

interface RawNode {
  path: number[];
  parentPath: number[] | null;
  tag: string;
  id?: string;
  classes: string[];
  role?: string;
  ariaLabel?: string;
  box: { x: number; y: number; w: number; h: number };
  visible: boolean;
  isStructural: boolean;
  text?: string;
  imageSrc?: string;
  media?: { type: "img" | "video"; src: string; naturalW: number; naturalH: number };
  counts: { images: number; videos: number; buttons: number; inputs: number; links: number };
  siblingIndex: number;
  selector: string;
}

/**
 * Percorre o DOM dentro do browser e devolve os nós candidatos com caixa em
 * ESPAÇO DE DOCUMENTO (getBoundingClientRect + scroll atual). O fingerprint é
 * calculado no Node, fora daqui: `node:crypto` não existe na página.
 */
export async function extractNodes(page: Page): Promise<SnapshotNode[]> {
  const raw: RawNode[] = await page.evaluate(() => {
    // O tsx (esbuild) compila função nomeada como `__name(function f(){}, "f")`
    // para preservar o nome, chamando um helper `__name` injetado uma vez no
    // topo do módulo compilado. O Playwright serializa este callback com
    // toString() e injeta só o texto da função na página -- sem o resto do
    // módulo, então esse helper não existe lá e a captura morre com
    // "__name is not defined".
    //
    // `const __name = (fn) => fn;` NÃO resolve: o próprio esbuild detecta a
    // colisão de nome com o helper que ele injeta e RENOMEIA a nossa
    // constante local para `__name2`, mantendo a chamada `__name(walk,
    // "walk")` apontando para o helper de módulo original (ausente aqui).
    // Confirmado compilando um repro mínimo com `npx tsx` e lendo o
    // `.toString()` gerado.
    //
    // Escrever na propriedade sobrevive porque não é um *binding* de
    // variável, então o renomeador do esbuild não mexe nela -- e dentro do
    // browser, `globalThis` é o mesmo objeto que `window`.
    //
    // Os testes normais NÃO pegam isso: rodam sob Vitest, que transforma o
    // código de outro jeito. Só o CLI real (tsx) reproduz -- daí o teste em
    // cli-subprocess.test.ts, que roda o CLI como subprocesso de verdade.
    (globalThis as unknown as { __name?: (fn: unknown) => unknown }).__name ??= (fn) => fn;

    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const out: RawNode[] = [];

    function cssSelector(el: Element): string {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      const index = Array.from(parent.children).indexOf(el) + 1;
      return `${cssSelector(parent)} > ${el.tagName.toLowerCase()}:nth-child(${index})`;
    }

    function walk(el: Element, path: number[], parentPath: number[] | null): void {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible =
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0;

      const parent = el.parentElement;
      const isDirectChildOfRoot =
        parent !== null && (parent.tagName === "MAIN" || parent.tagName === "BODY");

      const image = el.tagName === "IMG" ? (el as HTMLImageElement) : null;
      const video = el.tagName === "VIDEO" ? (el as HTMLVideoElement) : null;

      out.push({
        path,
        parentPath,
        tag: el.tagName.toLowerCase(),
        id: el.id || undefined,
        classes: Array.from(el.classList),
        role: el.getAttribute("role") ?? undefined,
        ariaLabel: el.getAttribute("aria-label") ?? undefined,
        box: {
          x: rect.left + scrollX,
          y: rect.top + scrollY,
          w: rect.width,
          h: rect.height,
        },
        visible,
        isStructural: isDirectChildOfRoot,
        text: (el.textContent ?? "").slice(0, 400) || undefined,
        imageSrc: image?.currentSrc || image?.src || undefined,
        media: image
          ? {
              type: "img",
              src: image.currentSrc || image.src,
              naturalW: image.naturalWidth,
              naturalH: image.naturalHeight,
            }
          : video
            ? {
                type: "video",
                src: video.currentSrc || video.src,
                naturalW: video.videoWidth,
                naturalH: video.videoHeight,
              }
            : undefined,
        counts: {
          images: el.querySelectorAll("img").length,
          videos: el.querySelectorAll("video").length,
          buttons: el.querySelectorAll("button").length,
          inputs: el.querySelectorAll("input, textarea, select").length,
          links: el.querySelectorAll("a").length,
        },
        siblingIndex: parent ? Array.from(parent.children).indexOf(el) : 0,
        selector: cssSelector(el),
      });

      Array.from(el.children).forEach((child, index) => {
        walk(child, [...path, index], path);
      });
    }

    const root = document.querySelector("main") ?? document.body;
    walk(root, [0], null);
    return out;
  });

  const idByPath = new Map<string, string>();
  raw.forEach((node, index) => idByPath.set(node.path.join("."), `n${index}`));

  return raw.map((node, index) => {
    const isSection =
      // O nó raiz (o próprio <main>) nunca é seção: ele contém todas elas.
      node.parentPath !== null &&
      node.visible &&
      node.box.h >= MIN_SECTION_HEIGHT &&
      (SECTION_TAGS.has(node.tag) || node.isStructural);

    return {
      nodeId: `n${index}`,
      parentId: node.parentPath ? (idByPath.get(node.parentPath.join(".")) ?? null) : null,
      fingerprint: fingerprint({
        tag: node.tag,
        id: node.id,
        text: node.text,
        imageSrc: node.imageSrc,
        siblingIndex: node.siblingIndex,
      }),
      selector: node.selector,
      tag: node.tag,
      id: node.id,
      classes: node.classes,
      role: node.role,
      ariaLabel: node.ariaLabel,
      box: node.box,
      visible: node.visible,
      isSection,
      text: node.text,
      media: node.media,
      counts: node.counts,
    } satisfies SnapshotNode;
  });
}
