import { z } from "zod";

/**
 * O "bytecode" do compilador: derivado a cada build e descartado. Não sobra
 * nenhum seletor, nenhuma URL e nenhum segundo -- só caminho de arquivo,
 * número de frame e caixa em pixel. Se o runner precisar consultar o site ou
 * o banco para renderizar, o compilador falhou.
 */
export const RenderManifestSchema = z.object({
  version: z.literal(1),
  projectId: z.string().min(1),
  compiledFrom: z.object({
    snapshotIds: z.array(z.string().min(1)),
    projectVersion: z.number().int().positive(),
  }),
  resolution: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  fps: z.number().int().positive(),
  totalFrames: z.number().int().positive(),
  clips: z.array(
    z
      .object({
        sceneId: z.string().min(1),
        startFrame: z.number().int().nonnegative(),
        endFrame: z.number().int().positive(),
        component: z.string().min(1),
        props: z.record(z.unknown()),
      })
      .refine((clip) => clip.endFrame > clip.startFrame, {
        message: "endFrame precisa ser maior que startFrame",
        path: ["endFrame"],
      }),
  ),
  audio: z.array(
    z.object({ file: z.string().min(1), startFrame: z.number().int().nonnegative() }),
  ),
});

export type RenderManifest = z.infer<typeof RenderManifestSchema>;
