import { z } from "zod";
import { paginationSchema } from "./pagination.dto.js";

const contractDataSchema = z.object({
  // Contratante
  tipoPessoa: z.enum(["PF", "PJ"]),
  nome: z.string().min(2).max(160),
  documento: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 11 || v.length === 14, "CPF (11) ou CNPJ (14 dígitos)."),
  email: z.string().email().max(200),
  telefone: z.string().min(8).max(20),
  endereco: z.string().min(5).max(300),
  nomeEmpresa: z.string().max(160).optional(),
  // Projeto
  tipo: z.enum(["SITE", "SISTEMA", "SAAS", "MANUTENCAO", "CONSULTORIA"]),
  descricaoProjeto: z.string().min(10).max(3000),
  valorTotal: z.coerce.number().positive().max(10_000_000),
  formaPagamento: z.enum(["PIX", "BOLETO", "CARTAO", "TRANSFERENCIA", "PARCELADO"]),
  percentualEntrada: z.coerce.number().min(0).max(100),
  prazoEntregaDias: z.coerce.number().int().min(1).max(365),
  limiteRevisoes: z.coerce.number().int().min(0).max(10).optional(),
});

export const createContractSchema = contractDataSchema.extend({
  leadId: z.string().min(1).optional(),
});
export type CreateContractRequest = z.infer<typeof createContractSchema>;

/** Formulário público: mesmo payload + slug da organização. */
export const publicCreateContractSchema = contractDataSchema.extend({
  organizationSlug: z.string().min(1).max(80),
});
export type PublicCreateContractRequest = z.infer<typeof publicCreateContractSchema>;

export const listContractsQuerySchema = paginationSchema.extend({
  status: z
    .enum([
      "RASCUNHO",
      "VALIDADO",
      "PDF_GERADO",
      "AGUARDANDO_ASSINATURA",
      "ASSINADO",
      "CANCELADO",
      "EXPIRADO",
    ])
    .optional(),
  tipo: z.enum(["SITE", "SISTEMA", "SAAS", "MANUTENCAO", "CONSULTORIA"]).optional(),
  companyId: z.string().min(1).optional(),
  search: z.string().max(120).optional(),
});
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;

export const updateContractStatusSchema = z.object({
  status: z.enum(["CANCELADO", "EXPIRADO", "AGUARDANDO_ASSINATURA"]),
});
