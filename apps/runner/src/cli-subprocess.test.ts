import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SnapshotSchema } from "@millead/video-contracts";
import { startFixtureServer } from "./testing/fixture-server.js";

const RUNNER_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

let server: Awaited<ReturnType<typeof startFixtureServer>>;

beforeAll(async () => {
  server = await startFixtureServer();
});

afterAll(async () => {
  await server?.close();
});

/**
 * Roda o CLI como o usuário roda: processo separado, sob tsx. A suíte normal
 * importa as funções e roda sob o transform do Vitest -- caminho diferente do
 * real, e foi exatamente por isso que o bug do `__name` chegou até a captura
 * do site de produção sem nenhum teste acusar.
 */
function runCli(url: string, capturesRoot: string): Promise<{ code: number; saida: string }> {
  return new Promise((resolve) => {
    const filho = spawn("npx", ["tsx", "src/cli.ts", url], {
      cwd: RUNNER_DIR,
      env: { ...process.env, VIDEO_RUNNER_ALLOW_PRIVATE: "1", MILLEAD_CAPTURES_ROOT: capturesRoot },
      shell: process.platform === "win32",
    });
    let saida = "";
    filho.stdout.on("data", (d) => (saida += String(d)));
    filho.stderr.on("data", (d) => (saida += String(d)));
    filho.on("close", (code) => resolve({ code: code ?? -1, saida }));
  });
}

describe("CLI rodando como subprocesso (caminho real do usuário)", () => {
  it("captura a fixture sem erro de runtime na página", async () => {
    const raiz = await mkdtemp(join(tmpdir(), "millead-cli-"));
    const { code, saida } = await runCli(`${server.url}/home.html`, raiz);

    // A mensagem exata do bug que motivou este teste.
    expect(saida).not.toContain("__name is not defined");
    expect(saida).not.toContain("page.evaluate:");
    expect(code).toBe(0);

    const caminho = /pacote gravado em (.+)/.exec(saida)?.[1]?.trim();
    expect(caminho).toBeTruthy();
    const json = JSON.parse(await readFile(join(caminho!, "snapshot.json"), "utf8"));
    expect(() => SnapshotSchema.parse(json)).not.toThrow();
    expect(json.nodes.filter((n: { isSection: boolean }) => n.isSection).length).toBeGreaterThan(0);
  }, 120_000);
});
