import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureTiles } from "./capture-tiles.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let browser: Browser;
let server: Awaited<ReturnType<typeof startFixtureServer>>;
let outDir: string;
let page: Page;
let tiles: Awaited<ReturnType<typeof captureTiles>>;

beforeAll(async () => {
  server = await startFixtureServer();
  browser = await chromium.launch();
  outDir = await mkdtemp(join(tmpdir(), "millead-tiles-"));
  page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
  tiles = await captureTiles(page, outDir);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("captureTiles", () => {
  it("cobre a página inteira em passos de um viewport", () => {
    // A fixture tem 900+700+1200+800+40+600+600 px de seções, mais paddings: > 3 telas.
    expect(tiles.length).toBeGreaterThanOrEqual(4);
  });

  it("grava os arquivos em disco", async () => {
    const files = await readdir(join(outDir, "tiles"));
    expect(files).toHaveLength(tiles.length);
    expect(files.every((f) => f.endsWith(".jpg"))).toBe(true);
  });

  it("registra o scrollY de cada tile em ordem crescente", () => {
    const ys = tiles.map((t) => t.scrollY);
    expect(ys[0]).toBe(0);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it("devolve caminhos relativos ao pacote, não absolutos", () => {
    expect(tiles.every((t) => t.file.startsWith("tiles/"))).toBe(true);
  });

  it("deixa a página de volta no topo ao terminar", async () => {
    // Nota: o brief original pegava a página via browser.contexts()[0].pages()[0],
    // mas isso é frágil -- guardamos a referência criada no beforeAll direto.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  it("grava o scrollY REAL, não o pedido: o último tile respeita o limite rolável", async () => {
    // Mesma referência guardada no beforeAll -- browser.contexts()[0].pages()[0]
    // é frágil demais nesse ambiente (ver nota acima).
    const limite = await page.evaluate(
      () => document.documentElement.scrollHeight - window.innerHeight,
    );
    const ultimo = tiles[tiles.length - 1]!;
    // Com o valor NOMINAL, o último tile daria acima do limite rolável.
    expect(ultimo.scrollY).toBeLessThanOrEqual(limite);
  });

  it("não repete a mesma posição em dois tiles", () => {
    const posicoes = tiles.map((t) => t.scrollY);
    expect(new Set(posicoes).size).toBe(posicoes.length);
  });
});
