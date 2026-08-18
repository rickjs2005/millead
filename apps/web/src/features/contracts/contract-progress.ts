import { CONTRACT_PENDING_STATUSES } from "@/features/contracts/contract-labels";
import type { ContractStatus } from "@/types/api";

/**
 * `processando` = tem worker trabalhando, vale ficar dando refetch.
 * `falhou` = parou numa falha; refetch não muda nada, o dono precisa agir.
 * `finalizado` = chegou num status estável (assinado, cancelado, aguardando...).
 */
export type ContractProgress = "processando" | "falhou" | "finalizado";

export function contractProgress(contract: {
  status: ContractStatus;
  falhouProcessamento: boolean;
}): ContractProgress {
  if (!CONTRACT_PENDING_STATUSES.includes(contract.status)) return "finalizado";
  return contract.falhouProcessamento ? "falhou" : "processando";
}

/**
 * Motivo que o worker gravou no evento de falha (ex.: "ZapSign
 * criarDocumento falhou: 402 ..."). É o que transforma "deu erro" em algo
 * acionável -- sem isso a mensagem na tela não diz o que consertar.
 */
export function mensagemDaFalha(
  eventos: readonly { tipo: string; payload: unknown; createdAt: string }[],
): string | null {
  const falha = eventos
    .filter((e) => e.tipo === "FALHA_PROCESSAMENTO")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const erro = (falha?.payload as { erro?: unknown } | null)?.erro;
  return typeof erro === "string" && erro.trim() !== "" ? erro : null;
}
