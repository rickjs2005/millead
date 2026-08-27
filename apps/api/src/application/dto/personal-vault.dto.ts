import { z } from "zod";

/**
 * Reautenticação pra abrir o Cofre. É a senha da conta, de novo -- não um PIN
 * separado: um PIN curto guardado no banco seria mais um segredo pra vazar e
 * mais fraco que a senha que já protege a conta inteira.
 *
 * Sem `.max()` agressivo nem regra de formato aqui de propósito: a validação
 * de força pertence à troca de senha, e recusar por formato nesta rota só
 * daria a um atacante um oráculo barato sobre o formato da senha certa.
 */
export const unlockVaultSchema = z.object({
  password: z.string().min(1).max(200),
});
export type UnlockVaultInput = z.infer<typeof unlockVaultSchema>;
