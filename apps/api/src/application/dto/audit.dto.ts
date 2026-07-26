import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const createAuditSchema = z.object({
  companyId: z.string().min(1),
});
export type CreateAuditRequest = z.infer<typeof createAuditSchema>;

export const listAuditsQuerySchema = paginationSchema.extend({
  companyId: z.string().min(1).optional(),
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]).optional(),
  /** Query string chega como texto -- só "true" liga o agrupamento. */
  latestPerCompany: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
export type ListAuditsQuery = z.infer<typeof listAuditsQuerySchema>;
