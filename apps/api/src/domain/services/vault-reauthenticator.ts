/**
 * Porta estreita: "confirme a senha atual de novo".
 *
 * Existe porque **exportar o Cofre inteiro nao e a mesma coisa que ler uma
 * tela**. A sessao elevada ja da acesso de leitura pagina a pagina, mas o
 * backup transforma "alguem passou tres minutos no notebook destravado" em
 * "alguem tem o historico financeiro inteiro num arquivo". Pedir a senha de
 * novo e proporcional ao que esta em jogo, e custa um campo.
 *
 * A porta usa o MESMO balde de tentativas do desbloqueio -- senao o endpoint
 * de exportacao viraria um oraculo de senha sem penalidade, testando
 * candidatas em volume enquanto a tela de desbloqueio ficava intacta.
 */

export interface ReauthContext {
  userId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface VaultReauthenticator {
  /**
   * Confirma a senha e devolve o `vaultId`. Lanca 401 quando a senha esta
   * errada ou o Cofre esta em castigo por tentativas.
   *
   * `action` entra na auditoria (`vault.export`, `vault.restore`) pra que a
   * trilha diga O QUE foi confirmado, nao so que houve uma confirmacao.
   */
  confirmPassword(context: ReauthContext, password: string, action: string): Promise<string>;
}
