import { z } from "zod";

const VERDADEIROS = new Set(["true", "1"]);
const FALSOS = new Set(["false", "0"]);

/**
 * Env var booleana lida do jeito que qualquer um espera: `FLAG=false` desliga.
 *
 * `z.coerce.boolean()` NÃO serve pra isso -- ele é `Boolean(valor)`, e toda
 * string não vazia vira `true`, inclusive `"false"`. Foi assim que
 * ZAPSIGN_SANDBOX ficou impossível de desligar sem apagar a variável.
 * Valor irreconhecível quebra o boot em vez de virar `true` calado.
 */
export function boolEnv(padrao: boolean) {
  return z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() ?? "")
    .superRefine((v, ctx) => {
      if (v !== "" && !VERDADEIROS.has(v) && !FALSOS.has(v)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `esperado true/false (ou 1/0), recebido "${v}"`,
        });
      }
    })
    .transform((v) => (v === "" ? padrao : VERDADEIROS.has(v)));
}
