/** Notificação enviada a TODOS os dispositivos inscritos da organização. */
export interface PushPayload {
  title: string;
  body: string;
  /** Rota do app aberta ao clicar (ex.: /briefings/abc123). */
  url?: string;
}

export interface PushSender {
  /** Best-effort: falha de push NUNCA pode derrubar o fluxo que notifica. */
  sendToOrg(organizationId: string, payload: PushPayload): Promise<void>;
}
