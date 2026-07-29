import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractNodes } from "./extract.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let browser: Browser;
let server: Awaited<ReturnType<typeof startFixtureServer>>;
let nodes: Awaited<ReturnType<typeof extractNodes>>;

beforeAll(async () => {
  server = await startFixtureServer();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
  nodes = await extractNodes(page);
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("extractNodes", () => {
  const sections = () => nodes.filter((n) => n.isSection);

  it("detecta as quatro seções reais da home", () => {
    expect(sections().map((n) => n.id)).toEqual(["hero", "sobre", "produtos", "contato"]);
  });

  it("não marca como seção o que está escondido", () => {
    expect(nodes.find((n) => n.id === "oculta")?.isSection).not.toBe(true);
  });

  it("não marca como seção o que é raso demais", () => {
    expect(nodes.find((n) => n.id === "rodape-fino")?.isSection).not.toBe(true);
  });

  it("usa coordenadas de documento, não de viewport", () => {
    const contato = sections().find((n) => n.id === "contato");
    expect(contato!.box.y).toBeGreaterThan(1080);
  });

  it("conta os elementos interativos da seção de contato", () => {
    const contato = sections().find((n) => n.id === "contato");
    expect(contato!.counts).toMatchObject({ inputs: 2, buttons: 1 });
  });

  it("dá a todo nó um nodeId único e um fingerprint", () => {
    const ids = new Set(nodes.map((n) => n.nodeId));
    expect(ids.size).toBe(nodes.length);
    expect(nodes.every((n) => n.fingerprint.length === 16)).toBe(true);
  });

  it("liga cada nó ao pai por parentId", () => {
    const produtos = nodes.find((n) => n.id === "produtos");
    const produtoB = nodes.find((n) => n.id === "produto-b");
    expect(produtoB!.parentId).toBe(produtos!.nodeId);
  });
});
