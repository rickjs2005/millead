import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { captureSections } from "./capture-sections.js";
import { extractNodes } from "./extract.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let browser: Browser;
let server: Awaited<ReturnType<typeof startFixtureServer>>;
let outDir: string;
let nodes: Awaited<ReturnType<typeof captureSections>>;

beforeAll(async () => {
  server = await startFixtureServer();
  browser = await chromium.launch();
  outDir = await mkdtemp(join(tmpdir(), "millead-sections-"));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
  nodes = await captureSections(page, await extractNodes(page), outDir);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("captureSections", () => {
  it("preenche screenshot em toda seção", () => {
    const sections = nodes.filter((n) => n.isSection);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.every((n) => typeof n.screenshot === "string")).toBe(true);
  });

  it("não põe screenshot em nó que não é seção", () => {
    expect(nodes.filter((n) => !n.isSection).every((n) => n.screenshot === undefined)).toBe(true);
  });

  it("nomeia o arquivo pelo id do elemento quando existe", () => {
    const hero = nodes.find((n) => n.id === "hero");
    expect(hero!.screenshot).toBe("sections/hero.jpg");
  });

  it("grava um arquivo por seção", async () => {
    const files = await readdir(join(outDir, "sections"));
    expect(files).toHaveLength(nodes.filter((n) => n.isSection).length);
  });

  it("não deixa duas seções colidirem no mesmo arquivo", async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
    const extraidos = await extractNodes(page);

    // Dois ids diferentes que normalizam para o mesmo slug.
    const secoes = extraidos.filter((n) => n.isSection);
    expect(secoes.length).toBeGreaterThanOrEqual(2);
    const corrompidos = extraidos.map((n) =>
      n.nodeId === secoes[0]!.nodeId
        ? { ...n, id: "Preço" }
        : n.nodeId === secoes[1]!.nodeId
          ? { ...n, id: "Preco" }
          : n,
    );

    const destino = await mkdtemp(join(tmpdir(), "millead-colisao-"));
    const resultado = await captureSections(page, corrompidos, destino);
    await page.close();

    const comFoto = resultado.filter((n) => n.isSection).map((n) => n.screenshot);
    // Nenhuma miniatura pode repetir caminho.
    expect(new Set(comFoto).size).toBe(comFoto.length);

    const arquivos = await readdir(join(destino, "sections"));
    expect(arquivos).toHaveLength(comFoto.length);
  });
});
