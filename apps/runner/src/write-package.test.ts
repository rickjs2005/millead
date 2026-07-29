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
    expect(id).toBe("milweb.com.br-home-desktop-20260729143200-25daa6");
    expect(id).toBe(buildSnapshotId(new URL("https://milweb.com.br/"), "2026-07-29T14:32:00.000Z"));
  });

  it("transforma o caminho em slug", () => {
    const id = buildSnapshotId(new URL("https://milweb.com.br/cases/kavita"), "2026-07-29T14:32:00.000Z");
    expect(id).toContain("cases-kavita");
  });

  it("não colide entre caminhos que normalizam para o mesmo slug", () => {
    const a = buildSnapshotId(new URL("https://site.com/a/b"), "2026-07-29T14:32:00.000Z");
    const b = buildSnapshotId(new URL("https://site.com/a-b"), "2026-07-29T14:32:00.000Z");
    expect(a).not.toBe(b);
  });

  it("distingue capturas da mesma URL no mesmo minuto", () => {
    const a = buildSnapshotId(new URL("https://site.com/"), "2026-07-29T14:32:05.000Z");
    const b = buildSnapshotId(new URL("https://site.com/"), "2026-07-29T14:32:47.000Z");
    expect(a).not.toBe(b);
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

  it("preserva o pacote anterior quando a validação falha", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "milweb.com.br-home-desktop-202607291432";

    // Pacote bom, de uma captura anterior.
    const anterior = join(root, id);
    await mkdir(anterior, { recursive: true });
    await writeFile(join(anterior, "snapshot.json"), '{"antigo":true}', "utf8");

    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(tmpDir, { recursive: true });
    const invalido = { ...snapshotBase(id), version: 99 } as unknown as Parameters<typeof writePackage>[0];

    await expect(writePackage(invalido, tmpDir, root)).rejects.toThrow(/snapshot inválido/i);

    // O pacote antigo tem que continuar lá, intacto.
    expect(await readFile(join(anterior, "snapshot.json"), "utf8")).toBe('{"antigo":true}');
  });

  it("substitui o pacote anterior quando a captura nova é válida", async () => {
    const root = await mkdtemp(join(tmpdir(), "millead-pkg-"));
    const id = "milweb.com.br-home-desktop-202607291432";

    const anterior = join(root, id);
    await mkdir(anterior, { recursive: true });
    await writeFile(join(anterior, "sobra.txt"), "lixo da captura antiga", "utf8");

    const tmpDir = join(root, `.tmp-${id}`);
    await mkdir(tmpDir, { recursive: true });

    const finalDir = await writePackage(snapshotBase(id), tmpDir, root);
    const arquivos = await readdir(finalDir);

    // Substituição, não fusão: o lixo antigo não pode sobreviver.
    expect(arquivos).toContain("snapshot.json");
    expect(arquivos).not.toContain("sobra.txt");
    // E nenhum diretório de trabalho pode ficar para trás.
    expect(await readdir(root)).toEqual([id]);
  });
});
