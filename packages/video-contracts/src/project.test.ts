import { describe, expect, it } from "vitest";
import { AnnotationSchema } from "./annotation.js";
import { RenderManifestSchema } from "./manifest.js";
import { VideoProjectSchema } from "./project.js";

describe("VideoProjectSchema", () => {
  const project = {
    version: 1 as const,
    id: "prj_kavita_reel",
    name: "Kavita — Reel de lançamento",
    snapshotIds: ["milweb.com.br-home-desktop-202607291432"],
    format: "9:16" as const,
    fps: 30,
    scenes: [
      {
        id: "sc1",
        type: "site" as const,
        source: { snapshotId: "milweb.com.br-home-desktop-202607291432", nodeId: "n0" },
        shot: "zoom" as const,
        durationSec: 8,
        hidden: [],
      },
      {
        id: "sc2",
        type: "studio" as const,
        component: "whatsapp" as const,
        props: { company: "Kavita Drones" },
        durationSec: 5,
      },
    ],
    voice: null,
  };

  it("aceita cenas de site e de estúdio na mesma timeline", () => {
    expect(() => VideoProjectSchema.parse(project)).not.toThrow();
  });

  it("recusa cena de site sem source", () => {
    const bad = structuredClone(project);
    delete (bad.scenes[0] as Record<string, unknown>).source;
    expect(() => VideoProjectSchema.parse(bad)).toThrow();
  });

  it("recusa componente de estúdio desconhecido", () => {
    const bad = structuredClone(project);
    (bad.scenes[1] as Record<string, unknown>).component = "tiktok";
    expect(() => VideoProjectSchema.parse(bad)).toThrow();
  });

  it("recusa id de cena duplicado", () => {
    const bad = structuredClone(project);
    bad.scenes[1]!.id = "sc1";
    expect(() => VideoProjectSchema.parse(bad)).toThrow(/duplicad/i);
  });
});

describe("AnnotationSchema", () => {
  it("exige evidence para sustentar a certainty", () => {
    const bad = {
      version: 1,
      id: "ann1",
      snapshotId: "s1",
      generatedAt: "2026-07-29T14:40:00.000Z",
      model: "claude-opus-5",
      promptVersion: "v1",
      labels: [{ nodeId: "n0", label: "Hero", kind: "hero", certainty: "alta", evidence: [] }],
      suggestion: { nodeIds: ["n0"], durationSec: 30, rationale: "abre com o hero" },
    };
    expect(() => AnnotationSchema.parse(bad)).toThrow(/evid/i);
  });
});

describe("RenderManifestSchema", () => {
  it("recusa clip com endFrame menor ou igual ao startFrame", () => {
    const bad = {
      version: 1,
      projectId: "prj_kavita_reel",
      compiledFrom: { snapshotIds: ["s1"], projectVersion: 1 },
      resolution: { w: 1080, h: 1920 },
      fps: 30,
      totalFrames: 900,
      clips: [{ sceneId: "sc1", startFrame: 60, endFrame: 60, component: "SiteZoom", props: {} }],
      audio: [],
    };
    expect(() => RenderManifestSchema.parse(bad)).toThrow(/endFrame/i);
  });
});
