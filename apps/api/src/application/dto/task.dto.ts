import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  leadId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  dueAt: z.coerce.date().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  assigneeId: z.string().min(1).nullable().optional(),
  dueAt: z.coerce.date().nullable().optional(),
  status: z.enum(["PENDING", "DONE", "CANCELLED"]).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = paginationSchema.extend({
  leadId: z.string().min(1).optional(),
  assigneeId: z.string().min(1).optional(),
  status: z.enum(["PENDING", "DONE", "CANCELLED"]).optional(),
  overdue: z.coerce.boolean().optional(),
});
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
