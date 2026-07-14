import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  document: z.string().max(32).optional(),
  segment: z.string().max(120).optional(),
  sizeEstimate: z.string().max(60).optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(60).optional(),
  country: z.string().max(2).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = createCompanySchema.partial();
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const listCompaniesQuerySchema = paginationSchema.extend({
  search: z.string().min(1).max(200).optional(),
});
export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;

export const addCompanyWebsiteSchema = z.object({
  url: z.string().url().max(500),
  isPrimary: z.boolean().optional(),
});
export type AddCompanyWebsiteInput = z.infer<typeof addCompanyWebsiteSchema>;

export const addCompanySocialSchema = z.object({
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "LINKEDIN", "TIKTOK", "WHATSAPP", "OTHER"]),
  handleOrUrl: z.string().min(1).max(300),
});
export type AddCompanySocialInput = z.infer<typeof addCompanySocialSchema>;
