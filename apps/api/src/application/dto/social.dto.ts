import { z } from "zod";

export const setFormatSchema = z.object({
  format: z.enum([
    "UNCLASSIFIED", "REDESIGN", "BEFORE_AFTER", "TIMELAPSE",
    "REVIEW", "ANIMATION", "CODE_SETUP", "OTHER",
  ]),
});
export type SetFormatInput = z.infer<typeof setFormatSchema>;
