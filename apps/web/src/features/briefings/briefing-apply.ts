/**
 * O briefing escolhido deve ser aplicado ao formulário agora?
 *
 * `jaAplicadoId` é a trava que importa: sem ela, cada re-renderização do
 * formulário reaplicava o prefill e sobrescrevia o que o dono tinha acabado
 * de digitar -- o campo simplesmente não aceitava texto, e o vai-e-volta
 * mantinha a aba em 100% de CPU.
 *
 * Comparar `detailId` com `briefingId` descarta resposta atrasada de uma
 * seleção anterior (o dono trocou de briefing antes da primeira carregar).
 */
export function deveAplicarBriefing(input: {
  detailId: string | undefined;
  briefingId: string | undefined;
  jaAplicadoId: string | null;
}): boolean {
  const { detailId, briefingId, jaAplicadoId } = input;
  if (!detailId || !briefingId) return false;
  if (detailId !== briefingId) return false;
  return detailId !== jaAplicadoId;
}
