import { randomBytes, createHash } from "node:crypto";

/** Token opaco de alta entropia -- não é JWT, não carrega claims. */
export function generateOpaqueToken(): string {
  return randomBytes(48).toString("base64url");
}

/**
 * SHA-256 (não bcrypt): é isso que vai pra `refresh_tokens.token_hash`.
 * Diferente de senha, um refresh token já É um segredo de alta entropia --
 * não precisa de salt nem de hash lento, e precisamos de um lookup
 * determinístico por igualdade (`WHERE token_hash = ?`), que bcrypt não
 * permite (teria que comparar contra cada linha da tabela).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const DURATION_UNITS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Parser mínimo pra strings tipo "15m", "30d", "1h" -- sem dependência extra. */
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Duração inválida: "${duration}" (use algo como "15m", "30d")`);
  }
  const [, value, unit] = match;
  return Number(value) * DURATION_UNITS[unit!]!;
}

export function durationFromNow(duration: string): Date {
  return new Date(Date.now() + parseDurationMs(duration));
}
