/**
 * Escapa os 5 caracteres HTML sensíveis antes de interpolar texto de
 * origem não confiável (ex.: `rejectReason` do aceite público -- input
 * livre, anônimo, até 2000 chars) num template de e-mail. Sem isso, um
 * `rejectReason` como `<a href="http://phishing...">clique aqui</a>` vira
 * markup de verdade no e-mail que o dono recebe.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
