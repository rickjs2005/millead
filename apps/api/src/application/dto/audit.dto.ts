import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const createAuditSchema = z.object({
  companyId: z.string().min(1),
});
export type CreateAuditRequest = z.infer<typeof createAuditSchema>;

export const listAuditsQuerySchema = paginationSchema.extend({
  companyId: z.string().min(1).optional(),
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]).optional(),
});
export type ListAuditsQuery = z.infer<typeof listAuditsQuerySchema>;
