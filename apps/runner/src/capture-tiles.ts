import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { Tile } from "@millead/video-contracts";
import type { Page } from "playwright";

export const MAX_TILES = 40;
const SETTLE_MS = 250;

/** Rola até o fim e volta, forçando o lazy-load a resolver antes da captura. */
async function primeLazyLoad(page: Page, viewportHeight: number): Promise<void> {
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < pageHeight; y += viewportHeight) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(SETTLE_MS);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Captura a página em tiles de um viewport cada, gravando o scrollY junto.
 * NÃO usa `fullPage: true`: o screenshot de página inteira do Playwright rola
 * a página por dentro e sai quebrado em site com pin/sticky.
 */
export async function captureTiles(page: Page, outDir: string): Promise<Tile[]> {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("a página não tem viewport definido");

  await mkdir(join(outDir, "tiles"), { recursive: true });
  await primeLazyLoad(page, viewport.height);

  let pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const tiles: Tile[] = [];

  for (let index = 0; index * viewport.height < pageHeight; index += 1) {
    if (index >= MAX_TILES) {
      throw new Error(
        `a página é alta demais: passou de ${MAX_TILES} telas (${MAX_TILES * viewport.height}px). ` +
          "Provavelmente tem scroll infinito.",
      );
    }

    await page.evaluate((top) => window.scrollTo(0, top), index * viewport.height);
    await page.waitForTimeout(SETTLE_MS);

    // O navegador RECORTA o scroll no limite rolável: pedir 4320 numa página
    // que só rola até 3760 para em 3760. Gravar o valor pedido em vez do real
    // desalinharia o último tile na hora de montar a página.
    const scrollY = await page.evaluate(() => window.scrollY);

    // Depois do recorte, o último tile pode cair na mesma posição do anterior.
    if (tiles.length > 0 && tiles[tiles.length - 1]!.scrollY === scrollY) break;

    // `.jpg`, não `.webp`: o page.screenshot do Playwright só escreve PNG e
    // JPEG. Qualidade 90 é de sobra para tile de referência e pesa bem menos
    // que PNG. A spec ainda diz .webp -- corrigida na Task 10, Step 4.
    const file = `tiles/${String(index).padStart(3, "0")}-y${scrollY}.jpg`;
    await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 90 });
    tiles.push({ file, scrollY, height: viewport.height });

    // Relê a altura: lazy-load pode ter empurrado o fim durante esta passada.
    // Sem isso, página que cresce sai incompleta em silêncio em vez de estourar
    // o teto de tiles.
    pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return tiles;
}
