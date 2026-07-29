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
});
