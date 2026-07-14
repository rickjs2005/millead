import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const createLandingPageSchema = z.object({
  companyId: z.string().min(1),
  leadId: z.string().min(1).optional(),
  kind: z.enum(["DEMO_SITE", "PITCH"]).default("DEMO_SITE"),
  title: z.string().max(120).optional(),
  brief: z.string().max(1000).optional(),
});
export type CreateLandingPageRequest = z.infer<typeof createLandingPageSchema>;

export const regenerateLandingPageSchema = z.object({
  brief: z.string().max(1000).optional(),
});

export const publishLandingPageSchema = z.object({
  published: z.boolean(),
});

export const listLandingPagesQuerySchema = paginationSchema.extend({
  companyId: z.string().min(1).optional(),
  status: z.enum(["QUEUED", "GENERATING", "READY", "FAILED"]).optional(),
});
export type ListLandingPagesQuery = z.infer<typeof listLandingPagesQuerySchema>;
