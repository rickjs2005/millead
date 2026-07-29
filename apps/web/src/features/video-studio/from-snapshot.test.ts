import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Snapshot, SnapshotNode } from "@millead/video-contracts";
import { SnapshotSchema } from "@millead/video-contracts";
import { describe, expect, it } from "vitest";
import { sectionsFromSnapshot, zoomCandidatesFor } from "./from-snapshot";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "testing",
  "snapshot-milweb.json",
);
const snapshot = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));

describe("sectionsFromSnapshot", () => {
  const secoes = sectionsFromSnapshot(snapshot);

  it("acha as seções reais do site, na ordem da página", () => {
    expect(secoes.map((s) => s.sectionId).slice(0, 2)).toEqual(["top", expect.any(String)]);
    expect(secoes.map((s) => s.sectionId)).toContain("raio-x");
    expect(secoes.map((s) => s.sectionId)).toContain("contact");
  });

  it("ordena por posição na página", () => {
    const ys = secoes.map((s) => s.box.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });

  it("dá sectionId único a toda seção, inclusive à que não tem id no HTML", () => {
    const ids = secoes.map((s) => s.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });

  it("usa o texto do heading como label quando existe", () => {
    const top = secoes.find((s) => s.sectionId === "top")!;
    expect(top.label.toLowerCase()).toContain("seu site pode ser");
  });

  it("aponta a miniatura quando a captura trouxe", () => {
    const top = secoes.find((s) => s.sectionId === "top")!;
    expect(top.screenshot).toBe("sections/top.jpg");
  });
});

describe("zoomCandidatesFor", () => {
  const secoes = sectionsFromSnapshot(snapshot);
  const top = secoes.find((s) => s.sectionId === "top")!;
  const raioX = secoes.find((s) => s.sectionId === "raio-x")!;

  it("acha os elementos reais do hero, com rótulo legível", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    const rotulos = alvos.map((a) => a.label).join(" | ");
    expect(rotulos).toMatch(/Falar no WhatsApp/);
    expect(rotulos).toMatch(/Ver projetos/);
  });

  it("acha o botão de ação da seção raio-x", () => {
    const alvos = zoomCandidatesFor(snapshot, raioX.nodeId);
    expect(alvos.map((a) => a.label).join(" | ")).toMatch(/diagn/i);
  });

  it("traz a caixa medida junto de cada alvo", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    expect(alvos.every((a) => a.box.w > 0 && a.box.h > 0)).toBe(true);
  });

  it("só devolve elemento contido na seção", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    expect(
      alvos.every((a) => a.box.y >= top.box.y - 1 && a.box.y + a.box.h <= top.box.y + top.box.h + 1),
    ).toBe(true);
  });

  it("põe título antes de ação e de mídia", () => {
    const alvos = zoomCandidatesFor(snapshot, top.nodeId);
    expect(alvos[0]!.label).toMatch(/^Título/);
  });

  it("nunca devolve mais de 8 alvos", () => {
    for (const secao of secoes) {
      expect(zoomCandidatesFor(snapshot, secao.nodeId).length).toBeLessThanOrEqual(8);
    }
  });

  it("devolve lista vazia para seção sem candidato", () => {
    const semCandidato = secoes.find((s) => zoomCandidatesFor(snapshot, s.nodeId).length === 0);
    expect(semCandidato).toBeTruthy();
  });

  it("devolve lista vazia para nodeId que não existe", () => {
    expect(zoomCandidatesFor(snapshot, "nao-existe")).toEqual([]);
  });

  it("trunca o rótulo em fronteira de palavra", () => {
    const alvos = zoomCandidatesFor(snapshot, sectionsFromSnapshot(snapshot)[0]!.nodeId);
    const titulo = alvos.find((a) => a.label.startsWith("Título"))!;
    expect(titulo.label).not.toMatch(/\S…"$/);
  });
});

/** Snapshot mínimo montado à mão, para exercitar caminhos que a fixture real não cobre. */
function snapshotSintetico(nodes: Partial<SnapshotNode>[]): Snapshot {
  const base = SnapshotSchema.parse(JSON.parse(readFileSync(FIXTURE, "utf8")));
  return {
    ...base,
    nodes: nodes.map((n, i) => ({
      nodeId: `s${i}`,
      parentId: null,
      fingerprint: `f${i}`.padEnd(16, "0"),
      selector: `#s${i}`,
      tag: "div",
      classes: [],
      box: { x: 0, y: 0, w: 1920, h: 100 },
      visible: true,
      isSection: false,
      ...n,
    })) as Snapshot["nodes"],
  };
}

describe("caminhos que a fixture real não exercita", () => {
  it("usa o slug do heading quando a seção não tem id no HTML", () => {
    const snap = snapshotSintetico([
      { nodeId: "sec", isSection: true, tag: "section", box: { x: 0, y: 0, w: 1920, h: 800 }, screenshot: "sections/x.jpg" },
      { nodeId: "h", tag: "h2", text: "Nossos Diferenciais", box: { x: 0, y: 40, w: 600, h: 48 } },
    ]);
    const [secao] = sectionsFromSnapshot(snap);
    expect(secao!.sectionId).toBe("nossos-diferenciais");
    expect(secao!.label).toBe("Nossos Diferenciais");
  });

  it("corta em 8 preservando título e ação antes de mídia", () => {
    const filhos = [
      ...Array.from({ length: 3 }, (_, i) => ({
        nodeId: `t${i}`, tag: "h3", text: `Titulo ${i}`,
        box: { x: 0, y: 100 + i * 60, w: 400, h: 40 },
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        nodeId: `b${i}`, tag: "button", text: `Acao ${i}`,
        box: { x: 0, y: 400 + i * 60, w: 200, h: 40 },
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        nodeId: `m${i}`, tag: "img",
        box: { x: 0, y: 700 + i * 60, w: 300, h: 50 },
      })),
    ];
    const snap = snapshotSintetico([
      { nodeId: "sec", isSection: true, tag: "section", id: "cheia", box: { x: 0, y: 0, w: 1920, h: 1200 }, screenshot: "sections/cheia.jpg" },
      ...filhos,
    ]);
    const alvos = zoomCandidatesFor(snap, "sec");

    expect(alvos).toHaveLength(8);           // 13 candidatos, teto de 8
    expect(alvos.slice(0, 3).every((a) => a.label.startsWith("Título"))).toBe(true);
    expect(alvos.slice(3, 7).every((a) => a.label.startsWith("Botão"))).toBe(true);
    // Sobrou uma vaga: entra mídia, e só uma das seis.
    expect(alvos.filter((a) => a.label === "Imagem")).toHaveLength(1);
  });

  it("dá ids únicos mesmo quando um id literal colide com o sufixo gerado", () => {
    const snap = snapshotSintetico([
      { nodeId: "a", isSection: true, tag: "section", box: { x: 0, y: 0, w: 1920, h: 400 }, screenshot: "sections/a.jpg" },
      { nodeId: "b", isSection: true, tag: "section", id: "secao-0", box: { x: 0, y: 400, w: 1920, h: 400 }, screenshot: "sections/b.jpg" },
      { nodeId: "c", isSection: true, tag: "section", box: { x: 0, y: 800, w: 1920, h: 400 }, screenshot: "sections/c.jpg" },
    ]);
    const ids = sectionsFromSnapshot(snap).map((s) => s.sectionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
