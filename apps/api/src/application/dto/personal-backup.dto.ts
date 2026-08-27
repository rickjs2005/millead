import { z } from "zod";

/**
 * A senha e obrigatoria nas duas rotas.
 *
 * Nao e paranoia: a sessao elevada da leitura tela a tela, mas a exportacao
 * entrega o Cofre inteiro num arquivo, e a restauracao escreve tudo. Ver o
 * comentario de `PersonalBackupService`.
 */
const password = z.string().min(1, "Confirme sua senha.");

export const exportVaultSchema = z.object({
  password,
  /** JSON e o backup; CSV e pra planilha e nao volta pra dentro do sistema. */
  format: z.enum(["json", "csv"]).default("json"),
});

export const restoreVaultSchema = z.object({
  password,
  /** O arquivo inteiro, como veio. A validacao de formato e versao acontece no
   *  service -- aqui um `z.object` detalhado so duplicaria a mesma regra num
   *  segundo lugar, e os dois divergiriam na primeira mudanca de formato. */
  backup: z.unknown().refine((v) => typeof v === "object" && v !== null, "Envie um backup válido."),
});

export type ExportVaultBody = z.infer<typeof exportVaultSchema>;
export type RestoreVaultBody = z.infer<typeof restoreVaultSchema>;
