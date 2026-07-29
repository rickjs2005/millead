import { mkdtemp, readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSnapshotId } from "./build-snapshot.js";
import { writePackage } from "./write-package.js";

function snapshotBase(id: string) {
  return {
    version: 1 as const,
    id,
    url: "https://milweb.com.br/",
    capturedAt: "2026-07-29T14:32:00.000Z",
    http: { status: 200, finalUrl: "https://milweb.com.br/", redirects: [] },
    page: { title: "MilWeb", description: "", lang: "pt-BR" },
    capture: {
      viewport: { width: 1920, height: 1080, dpr: 1 },
      userAgent: "MilLeadVideoBot/1.0",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      pageHeight: 2160,
      tiles: [{ file: "tiles/000-y0.jpg", scrollY: 0, height: 1080 }],
    },
    theme: { colors: [] },
    warnings: [],
    nodes: [],
  };
}

describe("buildSnapshotId", () => {
  it("é determinístico e inclui host, caminho, viewport e instante", () => {
    const id = buildSnapshotId(new URL("https://milweb.com.br/"), "2026-07-29T14:32:00.000Z");
    expect(id).toBe("milweb.com.br-home-desktop-202607291432");
    expect(id).toBe(buildSnapshotId(new URL("https://milweb.com.br/"), "2026-07-29T14:32:00.000Z"));
  });

  it("transforma o caminho em slug", () => {
    const id = buildSnapshotId(new URL("https://milweb.com.br/cases/kavita"), "2026-07-29T14:32:00.000Z");
    expect(id).toContain("cases-kavita");
  });
});

describe("writePackage", () => {
  it("renomeia o temporário para o diretório final quando o zod aprova", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "milweb.com.br-home-desktop-202607291432";
    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(join(tmpDir, "tiles"), { recursive: true });
    await writeFile(join(tmpDir, "tiles", "000-y0.jpg"), "fake");

    const finalDir = await writePackage(snapshotBase(id), tmpDir, root);

    expect(finalDir).toBe(join(root, id));
    const files = await readdir(finalDir);
    expect(files).toContain("snapshot.json");
    expect(files).toContain("tiles");
    expect(await readdir(root)).not.toContain(`.tmp-${id}`);
  });

  it("não deixa nada para trás quando a validação falha", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "quebrado";
    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(tmpDir, { recursive: true });

    const invalid = { ...snapshotBase(id), version: 99 } as unknown as Parameters<typeof writePackage>[0];

    await expect(writePackage(invalid, tmpDir, root)).rejects.toThrow(/snapshot inválido/i);
    expect(await readdir(root)).toEqual([]);
  });

  it("grava o snapshot.json indentado e reparseável", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "milweb.com.br-home-desktop-202607291432";
    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(tmpDir, { recursive: true });

    const finalDir = await writePackage(snapshotBase(id), tmpDir, root);
    const parsed = JSON.parse(await readFile(join(finalDir, "snapshot.json"), "utf8"));
    expect(parsed.id).toBe(id);
  });
});
