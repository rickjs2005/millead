import { z } from "zod";

const SiteSceneSchema = z.object({
  id: z.string().min(1),
  type: z.literal("site"),
  source: z.object({ snapshotId: z.string().min(1), nodeId: z.string().min(1) }),
  shot: z.enum(["scroll", "zoom", "hold"]),
  durationSec: z.number().positive(),
  // Vira `display:none` injetado antes da captura pesada.
  hidden: z.array(z.string()),
  caption: z.string().optional(),
});

const StudioSceneSchema = z.object({
  id: z.string().min(1),
  type: z.literal("studio"),
  component: z.enum(["notebook", "google", "whatsapp", "logo"]),
  props: z.record(z.unknown()),
  durationSec: z.number().positive(),
});

export const SceneSchema = z.discriminatedUnion("type", [SiteSceneSchema, StudioSceneSchema]);

export const VideoProjectSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    name: z.string().min(1),
    // Referencia snapshots, NUNCA uma URL: é o que torna o re-render reproduzível.
    snapshotIds: z.array(z.string().min(1)).min(1),
    format: z.enum(["9:16", "16:9", "1:1"]),
    fps: z.number().int().positive(),
    // Duração em SEGUNDOS aqui; frames só no RenderManifest.
    scenes: z.array(SceneSchema).min(1),
    voice: z
      .object({
        provider: z.string().min(1),
        voiceId: z.string().min(1),
        lines: z.array(z.object({ sceneId: z.string().min(1), text: z.string().min(1) })),
      })
      .nullable(),
  })
  .superRefine((project, ctx) => {
    const seen = new Set<string>();
    for (const scene of project.scenes) {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de cena duplicado: ${scene.id}`,
          path: ["scenes"],
        });
      }
      seen.add(scene.id);
    }
  });

export type Scene = z.infer<typeof SceneSchema>;
export type VideoProject = z.infer<typeof VideoProjectSchema>;
