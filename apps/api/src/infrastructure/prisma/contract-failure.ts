/**
 * O worker parou numa falha? É verdade quando o evento MAIS RECENTE do
 * contrato é `FALHA_PROCESSAMENTO` -- um "REPROCESSAMENTO" posterior (ou o
 * PDF_GERADO da nova tentativa) já significa que voltou pra fila.
 *
 * Sem isso, um contrato que falhou fica indistinguível de um que ainda está
 * processando: a tela mostra o spinner de "PDF gerado" pra sempre.
 */
export function falhouProcessamento(
  eventos: readonly { tipo: string; createdAt: Date }[],
): boolean {
  const ultimo = eventos.reduce<{ tipo: string; createdAt: Date } | null>(
    (mais, e) => (mais === null || e.createdAt > mais.createdAt ? e : mais),
    null,
  );
  return ultimo?.tipo === "FALHA_PROCESSAMENTO";
}
