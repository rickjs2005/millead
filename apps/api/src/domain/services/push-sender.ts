/** Conteúdo de uma notificação. */
export interface PushPayload {
  title: string;
  body: string;
  /** Rota do app aberta ao clicar (ex.: /briefings/abc123). */
  url?: string;
}

export interface PushSender {
  /** Best-effort: falha de push NUNCA pode derrubar o fluxo que notifica. */
  sendToOrg(organizationId: string, payload: PushPayload): Promise<void>;

  /**
   * Só os dispositivos DAQUELE usuário.
   *
   * Existe porque `sendToOrg` alcança todo mundo inscrito na organização — o
   * que é certo pra "briefing concluído" e errado pra "Claude renova amanhã —
   * R$120". Alerta do Cofre é dado financeiro pessoal, e mandá-lo pro
   * navegador da equipe seria o vazamento que o módulo inteiro existe pra
   * impedir, por uma porta que ninguém está olhando.
   */
  sendToUser(userId: string, payload: PushPayload): Promise<void>;
}
