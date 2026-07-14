import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1).max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor deve ser um hex válido, ex.: #38BDF8")
    .optional(),
});
export type CreateTagInput = z.infer<typeof createTagSchema>;
