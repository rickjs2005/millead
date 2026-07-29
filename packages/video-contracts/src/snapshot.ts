import { z } from "zod";

export const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number().nonnegative(),
  h: z.number().nonnegative(),
});

export const TileSchema = z.object({
  file: z.string().min(1),
  scrollY: z.number().nonnegative(),
  height: z.number().positive(),
});

export const SnapshotNodeSchema = z
  .object({
    nodeId: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    fingerprint: z.string().min(1),
    selector: z.string().min(1),
    tag: z.string().min(1),
    id: z.string().optional(),
    classes: z.array(z.string()),
    role: z.string().optional(),
    ariaLabel: z.string().optional(),
    box: BoxSchema,
    visible: z.boolean(),
    isSection: z.boolean(),
    text: z.string().optional(),
    media: z
      .object({
        type: z.enum(["img", "video"]),
        src: z.string(),
        naturalW: z.number().nonnegative(),
        naturalH: z.number().nonnegative(),
      })
      .optional(),
    counts: z
      .object({
        images: z.number().int().nonnegative(),
        videos: z.number().int().nonnegative(),
        buttons: z.number().int().nonnegative(),
        inputs: z.number().int().nonnegative(),
        links: z.number().int().nonnegative(),
      })
      .optional(),
    screenshot: z.string().optional(),
  })
  .refine((n) => !n.isSection || typeof n.screenshot === "string", {
    message: "nó com isSection true precisa de screenshot",
    path: ["screenshot"],
  });

export const SnapshotSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    url: z.string().url(),
    capturedAt: z.string().datetime(),
    http: z.object({
      status: z.number().int(),
      finalUrl: z.string().url(),
      redirects: z.array(z.string().url()),
    }),
    page: z.object({
      title: z.string(),
      description: z.string(),
      lang: z.string(),
    }),
    capture: z.object({
      viewport: z.object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        dpr: z.number().positive(),
      }),
      userAgent: z.string().min(1),
      locale: z.string().min(1),
      timezone: z.string().min(1),
      pageHeight: z.number().nonnegative(),
      tiles: z.array(TileSchema),
    }),
    theme: z.object({
      colors: z.array(z.object({ hex: z.string(), weight: z.number() })),
    }),
    warnings: z.array(z.string()),
    nodes: z.array(SnapshotNodeSchema),
  })
  .superRefine((snap, ctx) => {
    const seen = new Set<string>();
    for (const node of snap.nodes) {
      if (seen.has(node.nodeId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `nodeId duplicado: ${node.nodeId}`,
          path: ["nodes"],
        });
      }
      seen.add(node.nodeId);
    }
  });

export type Box = z.infer<typeof BoxSchema>;
export type Tile = z.infer<typeof TileSchema>;
export type SnapshotNode = z.infer<typeof SnapshotNodeSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
