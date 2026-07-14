import { z } from "zod";

export const createPipelineSchema = z.object({
  name: z.string().min(1).max(120),
  isDefault: z.boolean().optional(),
});
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;

export const addPipelineStageSchema = z.object({
  name: z.string().min(1).max(120),
  order: z.coerce.number().int().min(0),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  isWon: z.boolean().optional(),
  isLost: z.boolean().optional(),
});
export type AddPipelineStageInput = z.infer<typeof addPipelineStageSchema>;
