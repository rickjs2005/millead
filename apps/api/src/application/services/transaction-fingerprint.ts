import { createHash } from "node:crypto";
import { formatUtcDate } from "./vault-date.js";

/**
 * Chave de deduplicação de uma movimentação importada.
 *
 * Duas estratégias, **um índice só** (`@@unique([vaultId, fingerprint])`):
 *
 * 1. Com `externalId` (o FITID do OFX), a chave é derivada só dele. É o
 *    identificador que o próprio banco garante estável — banco que reescreve a
 *    descrição ou corrige o valor entre um extrato e outro continua sendo a
 *    mesma transação, e a reimportação não duplica.
 * 2. Sem FITID (CSV, quase sempre), a chave sai de origem + data + valor +
 *    direção + descrição normalizada.
 *
 * Um índice com duas estratégias, em vez de dois índices concorrentes: a
 * prioridade do FITID vira a forma de montar a chave, não uma regra de leitura
 * que algum caminho novo possa esquecer de aplicar.
 *
 * O FITID entra escopado pela origem porque ele é único DENTRO da conta, não no
 * mundo — dois bancos podem emitir o mesmo "1".
 */
export interface FingerprintInput {
  /** Id da conta ou do cartão de origem. */
  sourceId: string;
  externalId?: string | null;
  transactionDate: Date;
  /** Valor em BRL, string decimal (o que o Prisma devolve). */
  amountBrl: string;
  direction: "IN" | "OUT";
  normalizedDescription: string;
}

export function buildFingerprint(input: FingerprintInput): string {
  const externalId = input.externalId?.trim();
  if (externalId) {
    // Curto e legível: dá pra entender de onde veio olhando o banco.
    return `fitid:${sha(`${input.sourceId}|${externalId}`)}`;
  }

  const parts = [
    input.sourceId,
    formatUtcDate(input.transactionDate),
    input.direction,
    input.amountBrl,
    input.normalizedDescription,
  ];
  // Hash em vez do texto cru pra a chave caber num índice com tamanho
  // previsível, independente de quão longa a descrição do banco seja.
  return `calc:${sha(parts.join("|"))}`;
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
