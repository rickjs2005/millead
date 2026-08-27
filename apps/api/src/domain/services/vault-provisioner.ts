/**
 * Porta estreita pra provisionar um Cofre recém-criado (hoje: a árvore de
 * categorias padrão).
 *
 * Existe pra que `PersonalVaultService` — que cuida de segurança e sessão —
 * não passe a depender do catálogo financeiro inteiro só pra semear categorias
 * na criação. Ele conhece um verbo, não um agregado.
 */
export interface VaultProvisioner {
  /** Idempotente: chamar de novo não duplica nem desfaz o que foi renomeado. */
  seedDefaults(vaultId: string): Promise<void>;
}
