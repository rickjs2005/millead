/**
 * Porta estreita pra fechar o Cofre a partir de fluxos que não são do Cofre
 * (logout, troca de senha). Existe pra que `LogoutUseCase` e
 * `ChangePasswordUseCase` não passem a depender do módulo financeiro inteiro
 * só pra cortar uma sessão -- eles conhecem um verbo, não um agregado.
 */
export interface VaultLocker {
  /** Best-effort e silencioso: quem não tem Cofre não é erro, e nenhum destes
   *  fluxos pode falhar por causa dele. */
  lockOnLogout(userId: string): Promise<void>;
}
