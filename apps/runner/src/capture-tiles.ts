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

  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const tiles: Tile[] = [];

  for (let index = 0; index * viewport.height < pageHeight; index += 1) {
    if (index >= MAX_TILES) {
      throw new Error(
        `a página é alta demais: passou de ${MAX_TILES} telas (${MAX_TILES * viewport.height}px). ` +
          "Provavelmente tem scroll infinito.",
      );
    }
    const scrollY = index * viewport.height;
    await page.evaluate((top) => window.scrollTo(0, top), scrollY);
    await page.waitForTimeout(SETTLE_MS);

    // `.jpg`, não `.webp`: o page.screenshot do Playwright só escreve PNG e
    // JPEG. Qualidade 90 é de sobra para tile de referência e pesa bem menos
    // que PNG. A spec ainda diz .webp -- corrigida na Task 10, Step 4.
    const file = `tiles/${String(index).padStart(3, "0")}-y${scrollY}.jpg`;
    await page.screenshot({ path: join(outDir, file), type: "jpeg", quality: 90 });
    tiles.push({ file, scrollY, height: viewport.height });
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  return tiles;
}
