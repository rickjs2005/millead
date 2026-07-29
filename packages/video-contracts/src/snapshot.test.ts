import { describe, expect, it } from "vitest";
import { SnapshotSchema } from "./snapshot.js";

function validSnapshot() {
  return {
    version: 1 as const,
    id: "milweb.com.br-home-desktop-202607291432",
    url: "https://milweb.com.br/",
    capturedAt: "2026-07-29T14:32:00.000Z",
    http: { status: 200, finalUrl: "https://milweb.com.br/", redirects: [] },
    page: { title: "MilWeb", description: "Sites sob medida", lang: "pt-BR" },
    capture: {
      viewport: { width: 1920, height: 1080, dpr: 1 },
      userAgent: "MilLeadVideoBot/1.0",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      pageHeight: 4320,
      tiles: [{ file: "tiles/000-y0.webp", scrollY: 0, height: 1080 }],
    },
    theme: { colors: [{ hex: "#0B0B0F", weight: 0.62 }] },
    warnings: [],
    nodes: [
      {
        nodeId: "n0",
        parentId: null,
        fingerprint: "a1b2c3d4e5f60718",
        selector: "main > section:nth-child(1)",
        tag: "section",
        id: "hero",
        classes: ["min-h-screen"],
        box: { x: 0, y: 0, w: 1920, h: 1080 },
        visible: true,
        isSection: true,
        screenshot: "sections/hero.webp",
      },
    ],
  };
}

describe("SnapshotSchema", () => {
  it("aceita um snapshot completo", () => {
    expect(() => SnapshotSchema.parse(validSnapshot())).not.toThrow();
  });

  it("recusa version diferente de 1", () => {
    const bad = { ...validSnapshot(), version: 2 };
    expect(() => SnapshotSchema.parse(bad)).toThrow();
  });

  it("recusa nó de seção sem screenshot", () => {
    const snap = validSnapshot();
    const [node] = snap.nodes;
    delete (node as Record<string, unknown>).screenshot;
    expect(() => SnapshotSchema.parse(snap)).toThrow(/screenshot/i);
  });

  it("recusa caixa com largura negativa", () => {
    const snap = validSnapshot();
    snap.nodes[0]!.box.w = -1;
    expect(() => SnapshotSchema.parse(snap)).toThrow();
  });

  it("recusa nodeId duplicado", () => {
    const snap = validSnapshot();
    snap.nodes.push({ ...snap.nodes[0]! });
    expect(() => SnapshotSchema.parse(snap)).toThrow(/nodeId/i);
  });
});
