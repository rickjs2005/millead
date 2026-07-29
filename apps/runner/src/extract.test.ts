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

  it("não marca como seção o que é invisível por visibility ou opacity", () => {
    // As duas têm 600px de altura -- passam no corte de altura de propósito,
    // então quem tem que reprová-las é a checagem de visibilidade.
    expect(nodes.find((n) => n.id === "invisivel")?.isSection).not.toBe(true);
    expect(nodes.find((n) => n.id === "transparente")?.isSection).not.toBe(true);
  });

  it("usa coordenadas de documento: a caixa não muda quando a página rola", async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });

    const noTopo = await extractNodes(page);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(100);
    const rolado = await extractNodes(page);
    await page.close();

    const contatoTopo = noTopo.find((n) => n.id === "contato")!;
    const contatoRolado = rolado.find((n) => n.id === "contato")!;

    // Coordenada de documento é invariante ao scroll. Se fosse de viewport,
    // a segunda leitura viria 1500px menor.
    expect(contatoRolado.box.y).toBe(contatoTopo.box.y);
    expect(contatoTopo.box.y).toBeGreaterThan(1080);
  });

  it("conta os elementos interativos da seção de contato", () => {
    const contato = sections().find((n) => n.id === "contato");
    expect(contato!.counts).toMatchObject({ inputs: 2, buttons: 1 });
  });

  it("dá a todo nó um fingerprint, e a mesma página gera os mesmos ids duas vezes", async () => {
    expect(nodes.every((n) => n.fingerprint.length === 16)).toBe(true);

    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(`${server.url}/home.html`, { waitUntil: "networkidle" });
    const segunda = await extractNodes(page);
    await page.close();

    expect(segunda.map((n) => n.nodeId)).toEqual(nodes.map((n) => n.nodeId));
    expect(segunda.map((n) => n.fingerprint)).toEqual(nodes.map((n) => n.fingerprint));
  });

  it("liga cada nó ao pai por parentId", () => {
    const produtos = nodes.find((n) => n.id === "produtos");
    const produtoB = nodes.find((n) => n.id === "produto-b");
    expect(produtoB!.parentId).toBe(produtos!.nodeId);
  });
});
