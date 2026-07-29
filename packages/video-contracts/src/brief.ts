import { z } from "zod";

/**
 * Intenção de vídeo, decidida pelo humano no formulário. NÃO é um VideoProject:
 * aqui a cena de site aponta para um SLOT semântico ("hero"), não para um nó de
 * um Snapshot -- o Brief é produzido antes de o site ter sido capturado. Quando
 * o crawler existir, um compilador junta Brief + Snapshot -> VideoProject.
 */

export const SITE_SLOTS = [
  "hero",
  "sobre",
  "servicos",
  "produtos",
  "depoimentos",
  "faq",
  "formulario",
  "rodape",
] as const;

const SiteSlotSchema = z.enum(SITE_SLOTS);

const SiteSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("site"),
  slot: SiteSlotSchema,
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  note: z.string().optional(),
});

const NotebookSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("notebook"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
});

const GoogleSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("google"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  query: z.string().min(1),
  resultUrl: z.string().url(),
});

const WhatsappSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("whatsapp"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  company: z.string().min(1),
  message: z.string().min(1),
});

const LogoSceneSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("studio"),
  component: z.literal("logo"),
  durationSec: z.number().positive(),
  zoomTargets: z.array(z.string().min(1)),
  tagline: z.string().nullable(),
});

/**
 * Union por `component` dentro do ramo studio: props EXPLÍCITAS por componente,
 * nunca uma sacola `z.record(z.unknown())` -- é o que faz o zod recusar uma cena
 * google sem `query`.
 */
const StudioSceneSchema = z.discriminatedUnion("component", [
  NotebookSceneSchema,
  GoogleSceneSchema,
  WhatsappSceneSchema,
  LogoSceneSchema,
]);

export const BriefSceneSchema = z.union([SiteSceneSchema, StudioSceneSchema]);

export const VideoBriefSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    createdAt: z.string().datetime(),
    business: z.object({
      name: z.string().min(1),
      url: z.string().url("informe uma URL válida, começando com http:// ou https://"),
      segment: z.string().nullable(),
    }),
    template: z.object({ id: z.string().min(1), name: z.string().min(1) }),
    format: z.enum(["9:16", "16:9", "1:1"]),
    fps: z.number().int().positive(),
    totalDurationSec: z.number().positive(),
    wordBudget: z.number().int().nonnegative(),
    scenes: z.array(BriefSceneSchema).min(1),
    narration: z.object({
      mode: z.enum(["auto", "manual", "custom"]),
      text: z.string().nullable(),
      customInstructions: z.string().nullable(),
    }),
  })
  .superRefine((brief, ctx) => {
    const seen = new Set<string>();
    for (const scene of brief.scenes) {
      if (seen.has(scene.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `id de cena duplicado: ${scene.id}`,
          path: ["scenes"],
        });
      }
      seen.add(scene.id);
    }

    const soma = brief.scenes.reduce((total, scene) => total + scene.durationSec, 0);
    if (soma !== brief.totalDurationSec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `totalDurationSec (${brief.totalDurationSec}) não bate com a soma das cenas (${soma})`,
        path: ["totalDurationSec"],
      });
    }

    if (brief.narration.mode === "manual" && !brief.narration.text?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "narração manual exige o texto escrito",
        path: ["narration", "text"],
      });
    }

    if (brief.narration.mode === "custom" && !brief.narration.customInstructions?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "modo de instruções próprias exige as instruções",
        path: ["narration", "customInstructions"],
      });
    }
  });

export type SiteSlot = (typeof SITE_SLOTS)[number];
export type BriefScene = z.infer<typeof BriefSceneSchema>;
export type StudioComponent = Extract<BriefScene, { kind: "studio" }>["component"];
export type VideoBrief = z.infer<typeof VideoBriefSchema>;
