import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SnapshotNode } from "@millead/video-contracts";
import type { Page } from "playwright";

const SETTLE_MS = 250;

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

  for (const [index, node] of nodes.entries()) {
    if (!node.isSection) {
      result.push(node);
      continue;
    }

    const file = `sections/${slugFor(node, index)}.jpg`;
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

  await page.evaluate(() => window.scrollTo(0, 0));
  return result;
}
