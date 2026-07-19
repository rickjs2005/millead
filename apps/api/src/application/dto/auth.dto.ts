import { z } from "zod";

export const registerSchema = z.object({
  organizationName: z.string().min(2).max(120),
  name: z.string().min(2).max(120),
  // trim+lowercase ANTES de validar formato -- senão "user@x.com " (com
  // espaço) cai no e-mail errado (case/whitespace-sensível) e cria conta
  // duplicada de "user@x.com".
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  /** Opcional: só é obrigatório se o usuário pertencer a mais de uma organização. */
  organizationSlug: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z.object({
  refreshToken: z.string().min(1),
});
export type LogoutInput = z.infer<typeof logoutSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual."),
  // Mesma política do registro: min 8, max 72 (limite de bytes do bcrypt).
  newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres.").max(72),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
