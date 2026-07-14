import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const createMeetingSchema = z.object({
  title: z.string().min(1).max(200),
  leadId: z.string().min(1).optional(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.coerce.number().int().positive().max(1440).optional(),
  location: z.enum(["ONLINE", "IN_PERSON", "PHONE"]).optional(),
  meetingUrl: z.string().url().max(500).optional(),
});
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  scheduledAt: z.coerce.date().optional(),
  durationMinutes: z.coerce.number().int().positive().max(1440).optional(),
  location: z.enum(["ONLINE", "IN_PERSON", "PHONE"]).optional(),
  meetingUrl: z.string().url().max(500).nullable().optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"]).optional(),
});
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

export const listMeetingsQuerySchema = paginationSchema.extend({
  leadId: z.string().min(1).optional(),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELED", "NO_SHOW"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ListMeetingsQuery = z.infer<typeof listMeetingsQuerySchema>;

export const addMeetingAttendeeSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().optional(),
  userId: z.string().min(1).optional(),
  isInternal: z.boolean().optional(),
});
export type AddMeetingAttendeeInput = z.infer<typeof addMeetingAttendeeSchema>;
