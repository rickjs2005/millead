import { z } from "zod";

/**
 * Entrada da importação.
 *
 * O arquivo chega como **texto** no corpo JSON, não como upload multipart. É
 * uma escolha: multipart pediria storage (o `@vercel/blob` que os briefings
 * usam) e storage é exatamente o que este módulo não pode ter — extrato
 * bancário não fica guardado em lugar nenhum. Como texto, ele existe só na
 * memória do processo durante a requisição.
 *
 * O limite de 1 MB do body-parser vale aqui e é folgado: um extrato mensal em
 * CSV tem uns 15 KB e em OFX uns 50 KB. Arquivo maior que isso é ano inteiro
 * de uma vez — a mensagem de erro sugere importar por período.
 */

const MAX_CONTENT = 900_000;

const origin = {
  accountId: z.string().min(1).nullable().default(null),
  cardId: z.string().min(1).nullable().default(null),
};

const originRefine = <T extends { accountId: string | null; cardId: string | null }>(v: T) =>
  (v.accountId === null) !== (v.cardId === null);

const columnRef = z.union([z.string().min(1).max(120), z.coerce.number().int().min(0).max(200)]);

export const importSettingsSchema = z.object({
  delimiter: z.enum([",", ";", "\t", "|"]).default(","),
  decimalSeparator: z.enum([",", "."]).default(","),
  dateOrder: z.enum(["DMY", "MDY", "YMD"]).default("DMY"),
  hasHeader: z.boolean().default(true),
  invertSign: z.boolean().default(false),
  columnMap: z
    .object({
      date: columnRef,
      description: columnRef,
      amount: columnRef.optional(),
      debit: columnRef.optional(),
      credit: columnRef.optional(),
      externalId: columnRef.optional(),
    })
    // Ou uma coluna de valor com sinal, ou o par débito/crédito. Sem nenhum
    // dos dois não há como saber quanto foi nem pra que lado.
    .refine(
      (map) => map.amount !== undefined || map.debit !== undefined || map.credit !== undefined,
      {
        message: "Mapeie a coluna de valor, ou as colunas de débito e crédito.",
      },
    ),
});
export type ImportSettingsBody = z.infer<typeof importSettingsSchema>;

export const previewImportSchema = z
  .object({
    ...origin,
    fileName: z.string().min(1).max(255),
    content: z
      .string()
      .min(1)
      .max(
        MAX_CONTENT,
        "Arquivo grande demais. Exporte por período (um mês por vez) e importe em partes.",
      ),
    profileId: z.string().min(1).nullable().default(null),
    settings: importSettingsSchema.nullable().default(null),
  })
  .refine(originRefine, {
    message: "Informe exatamente uma origem: conta ou cartão.",
    path: ["accountId"],
  });
export type PreviewImportBody = z.infer<typeof previewImportSchema>;

export const confirmImportSchema = z
  .object({
    ...origin,
    fileName: z.string().min(1).max(255),
    fileHash: z.string().regex(/^[0-9a-f]{64}$/, "Hash inválido."),
    format: z.enum(["OFX", "CSV"]),
    rows: z
      .array(
        z.object({
          line: z.coerce.number().int().min(1),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use AAAA-MM-DD."),
          description: z.string().min(1).max(300),
          amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido."),
          direction: z.enum(["IN", "OUT"]),
          externalId: z.string().max(120).nullable().default(null),
        }),
      )
      .min(1)
      .max(5000, "Muitas linhas de uma vez. Importe por período."),
    /** Só código e número da linha — nunca o conteúdo do extrato. */
    ignored: z
      .array(
        z.object({
          line: z.coerce.number().int().min(1),
          code: z.string().min(1).max(40),
        }),
      )
      .max(5000)
      .default([]),
  })
  .refine(originRefine, {
    message: "Informe exatamente uma origem: conta ou cartão.",
    path: ["accountId"],
  });
export type ConfirmImportBody = z.infer<typeof confirmImportSchema>;

export const createImportProfileSchema = z
  .object({
    ...origin,
    name: z.string().min(1).max(80),
    format: z.enum(["OFX", "CSV"]).default("CSV"),
  })
  .merge(importSettingsSchema)
  // Perfil pode ser genérico (sem origem), então aqui a origem é opcional --
  // diferente da importação, onde ela é obrigatória.
  .refine((v) => !(v.accountId !== null && v.cardId !== null), {
    message: "Um modelo pertence a uma conta OU a um cartão, não aos dois.",
    path: ["cardId"],
  });
export type CreateImportProfileBody = z.infer<typeof createImportProfileSchema>;

export const updateImportProfileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  accountId: z.string().min(1).nullable().optional(),
  cardId: z.string().min(1).nullable().optional(),
  delimiter: z.enum([",", ";", "\t", "|"]).optional(),
  decimalSeparator: z.enum([",", "."]).optional(),
  dateOrder: z.enum(["DMY", "MDY", "YMD"]).optional(),
  hasHeader: z.boolean().optional(),
  invertSign: z.boolean().optional(),
  columnMap: importSettingsSchema.shape.columnMap.optional(),
});
export type UpdateImportProfileBody = z.infer<typeof updateImportProfileSchema>;

export const importHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ImportHistoryQuery = z.infer<typeof importHistoryQuerySchema>;
