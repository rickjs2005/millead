import { z } from "zod";

export const createProjectChecklistSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["INSTITUTIONAL", "SYSTEM"]),
  companyId: z.string().min(1).optional(),
  localFolder: z.string().min(1).max(200).optional(),
});
export type CreateProjectChecklistInput = z.infer<typeof createProjectChecklistSchema>;

export const updatePhaseStatusSchema = z
  .object({
    status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "NOT_APPLICABLE"]),
    naNote: z.string().min(1).max(500).optional(),
  })
  .refine((data) => data.status !== "NOT_APPLICABLE" || !!data.naNote, {
    message: "naNote é obrigatório quando status é NOT_APPLICABLE.",
    path: ["naNote"],
  });
export type UpdatePhaseStatusInput = z.infer<typeof updatePhaseStatusSchema>;
