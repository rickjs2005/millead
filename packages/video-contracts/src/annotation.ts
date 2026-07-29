import { z } from "zod";

export const AnnotationSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  snapshotId: z.string().min(1),
  generatedAt: z.string().datetime(),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  labels: z.array(
    z.object({
      nodeId: z.string().min(1),
      label: z.string().min(1),
      kind: z.string().min(1),
      // Derivada dos sinais determinísticos em `evidence` -- nunca um número
      // auto-relatado pelo modelo.
      certainty: z.enum(["alta", "media", "baixa"]),
      evidence: z.array(z.string()).min(1, "certainty precisa de ao menos uma evidência"),
    }),
  ),
  suggestion: z.object({
    nodeIds: z.array(z.string().min(1)),
    durationSec: z.number().positive(),
    rationale: z.string().min(1),
  }),
});

export type Annotation = z.infer<typeof AnnotationSchema>;
