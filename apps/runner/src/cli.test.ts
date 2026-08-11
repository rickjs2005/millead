import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SnapshotSchema } from "@millead/video-contracts";
import { runCapture } from "./cli.js";
import { startFixtureServer } from "./testing/fixture-server.js";

let server: Awaited<ReturnType<typeof startFixtureServer>>;
let capturesRoot: string;
let finalDir: string;

beforeAll(async () => {
  server = await startFixtureServer();
  capturesRoot = await mkdtemp(join(tmpdir(), "millead-captures-"));
  finalDir = await runCapture(`${server.url}/home.html`, {
    capturedAt: "2026-07-29T14:32:00.000Z",
    capturesRoot,
    allowPrivate: true,
  });
});

afterAll(async () => {
  await server?.close();
});

describe("runCapture", () => {
  it("produz um pacote que valida no schema", async () => {
    const json = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    expect(() => SnapshotSchema.parse(json)).not.toThrow();
  });

  it("grava snapshot.json, dom.html, tiles e sections", async () => {
    const files = await readdir(finalDir);
    expect(files).toEqual(
      expect.arrayContaining(["snapshot.json", "dom.html", "tiles", "sections"]),
    );
  });

  it("guarda o HTML servido cru, para reprocessar sem reabrir o site", async () => {
    const html = await readFile(join(finalDir, "dom.html"), "utf8");
    expect(html).toContain('id="produtos"');
  });

  it("identifica as seções da fixture", async () => {
    const json = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    const ids = json.nodes
      .filter((n: { isSection: boolean }) => n.isSection)
      .map((n: { id: string }) => n.id);
    expect(ids).toEqual(["hero", "sobre", "produtos", "contato"]);
  });

  it("é determinístico: dois capturas iguais só diferem em id e capturedAt", async () => {
    const outro = await runCapture(`${server.url}/home.html`, {
      capturedAt: "2026-07-29T15:00:00.000Z",
      capturesRoot,
      allowPrivate: true,
    });
    const a = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    const b = JSON.parse(await readFile(join(outro, "snapshot.json"), "utf8"));
    delete a.id;
    delete a.capturedAt;
    delete a.url;
    delete a.http;
    delete a.capture.tiles;
    delete b.id;
    delete b.capturedAt;
    delete b.url;
    delete b.http;
    delete b.capture.tiles;
    expect(b).toEqual(a);
  });

  it("recusa alvo interno quando allowPrivate está desligado", async () => {
    await expect(
      runCapture(`${server.url}/home.html`, {
        capturedAt: "2026-07-29T15:00:00.000Z",
        capturesRoot,
      }),
    ).rejects.toThrow(/interno/i);
  });

  it("falha com mensagem clara quando a página não existe", async () => {
    await expect(
      runCapture(`${server.url}/nao-existe.html`, {
        capturedAt: "2026-07-29T15:00:00.000Z",
        capturesRoot,
        allowPrivate: true,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });

  it("não deixa temporário para trás quando o Chromium não sobe", async () => {
    // PLAYWRIGHT_BROWSERS_PATH não serve aqui: o `beforeAll` já lançou o
    // Chromium com sucesso antes deste teste rodar, e a Registry do
    // playwright-core é um singleton que já cacheou o diretório de browsers
    // -- mudar a env var depois não tem efeito nenhum. Em vez disso, força a
    // falha diretamente no método que o cli.ts chama.
    const raiz = await mkdtemp(join(tmpdir(), "millead-launch-"));
    const launchSpy = vi
      .spyOn(chromium, "launch")
      .mockRejectedValueOnce(new Error("browserType.launch: Executable doesn't exist"));

    try {
      await expect(
        runCapture(`${server.url}/home.html`, {
          capturedAt: "2026-07-29T16:00:00.000Z",
          capturesRoot: raiz,
          allowPrivate: true,
        }),
      ).rejects.toThrow();

      const restos = await readdir(raiz);
      expect(restos.filter((nome) => nome.startsWith(".tmp-"))).toEqual([]);
    } finally {
      launchSpy.mockRestore();
    }
  });
});
