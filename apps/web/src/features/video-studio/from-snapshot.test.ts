import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
});
