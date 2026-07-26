import { z } from "zod";

/** Texto livre do briefing -- limitado pra não virar vetor de custo de token. */
const text = (max: number) => z.string().trim().max(max).default("");

export const creativeDirectionSchema = z.object({
  businessName: text(200),
  segment: text(200),
  description: text(2000),
  audience: text(1000),
  differentials: text(2000),
  competitors: text(1000),
  averageTicket: text(200),
  location: text(200),
  contact: text(200),

  goal: z.string().trim().min(1).max(120),
  contentLanguage: z.string().trim().min(1).max(60),
  emotion: z.string().trim().min(1).max(120),
  archetype: z.string().trim().min(1).max(120),
  designStyle: z.string().trim().min(1).max(200),

  palette: text(300),
  references: text(500),

  luxury: z.string().trim().min(1).max(300),
  boldness: z.string().trim().min(1).max(300),
  motion: z.string().trim().min(1).max(300),
  videoWeight: z.string().trim().min(1).max(300),

  sceneCount: z.number().int().min(0).max(12),
  sections: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  stack: z.string().trim().min(1).max(2000),
  notes: text(4000),
});

export type CreativeDirectionRequest = z.infer<typeof creativeDirectionSchema>;
