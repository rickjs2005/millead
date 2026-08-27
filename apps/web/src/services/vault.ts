import { api } from "./api-client";
import type { VaultStatus } from "@/types/api";

/**
 * Cofre Financeiro.
 *
 * `unlock`/`lock` NÃO passam pelo proxy genérico (`/api/bff/api/v1/...`):
 * chamam rotas próprias do BFF (`/api/bff/vault/...`), porque é lá que a
 * sessão elevada vira cookie httpOnly. Se passassem pelo proxy, o token
 * voltaria no corpo e o JS do navegador guardaria a chave do Cofre.
 */
export const vaultService = {
  status: () => api.get<VaultStatus>("/api/v1/vault/status"),
  create: () => api.post<{ created: boolean }>("/api/v1/vault"),
  /** 200 = aberto. 401 VAULT_LOCKED = fechado. 404 = não existe Cofre. */
  session: () => api.get<{ open: true }>("/api/v1/vault/session"),

  unlock: async (password: string): Promise<void> => {
    const res = await fetch("/api/bff/vault/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
      } | null;
      throw new Error(body?.error?.message ?? "Não foi possível abrir o Cofre.");
    }
  },

  lock: async (): Promise<void> => {
    await fetch("/api/bff/vault/lock", { method: "POST", credentials: "include" });
  },
};
