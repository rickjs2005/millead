import { z } from "zod";

export const draftMessageSchema = z.object({
  channel: z.enum(["WHATSAPP", "EMAIL", "SMS"]),
  templateId: z.string().min(1).optional(),
  instructions: z.string().max(500).optional(),
});
export type DraftMessageRequest = z.infer<typeof draftMessageSchema>;
