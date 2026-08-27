import type { VaultAlertType, VaultTransaction } from "@/types/api";

/**
 * Data de calendário do Cofre.
 *
 * As colunas de data são `@db.Date` e chegam como meia-noite **UTC**
 * (`2026-08-27T00:00:00.000Z`). O `formatDate` genérico do app renderiza no
 * fuso local, e em UTC-3 isso mostraria **26 de agosto** — todo lançamento do
 * Cofre apareceria um dia antes. Aqui o fuso é fixado em UTC de propósito: a
 * data não tem hora, então não há o que converter.
 */
export function formatVaultDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** `AAAA-MM-DD` a partir de uma data do Cofre — o formato que a API espera. */
export function toVaultDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** Hoje em `AAAA-MM-DD`, no fuso local — é o dia que a pessoa está vendo. */
export function todayInput(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Conta corrente",
  SAVINGS: "Poupança",
  DIGITAL_WALLET: "Carteira digital",
  CASH: "Dinheiro",
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  IGNORED: "Ignorada",
  REVERSED: "Estornada",
};

export const STATEMENT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Aberta",
  CLOSED: "Fechada",
  PARTIAL: "Parcial",
  PAID: "Paga",
  OVERDUE: "Atrasada",
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  CANCELED: "Cancelada",
};

export const PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Mensal",
  YEARLY: "Anual",
  CUSTOM: "Personalizada",
};

export const SPLIT_KIND_LABELS: Record<string, string> = {
  PERSONAL: "Pessoal",
  REIMBURSABLE: "A receber",
  BUSINESS: "MilWeb",
};

export const IMPORT_ERROR_LABELS: Record<string, string> = {
  COLUNA_AUSENTE: "Coluna não encontrada",
  DATA_INVALIDA: "Data ilegível",
  VALOR_INVALIDO: "Valor ilegível",
  DESCRICAO_VAZIA: "Sem descrição",
};

/** Texto do alerta a partir do tipo e do que o back mandou no payload. */
export function describeAlert(type: VaultAlertType, payload: Record<string, unknown>): string {
  const nome = typeof payload.name === "string" ? payload.name : "Assinatura";
  const esperado = typeof payload.expectedAmount === "string" ? payload.expectedAmount : null;
  const cobrado = typeof payload.chargedAmount === "string" ? payload.chargedAmount : null;

  switch (type) {
    case "RENEWS_TODAY":
      return `${nome} renova hoje${esperado ? ` — valor esperado R$ ${esperado}` : ""}.`;
    case "RENEWS_TOMORROW":
      return `${nome} renova amanhã${esperado ? ` — valor esperado R$ ${esperado}` : ""}.`;
    case "RENEWS_IN_3_DAYS":
      return `${nome} renova em 3 dias${esperado ? ` — valor esperado R$ ${esperado}` : ""}.`;
    case "RENEWS_IN_7_DAYS":
      return `${nome} renova em 7 dias${esperado ? ` — valor esperado R$ ${esperado}` : ""}.`;
    case "PRICE_CHANGED":
      return `${nome} veio R$ ${cobrado ?? "?"} — esperado era R$ ${esperado ?? "?"}.`;
    case "MISSING_CHARGE":
      return `${nome} deveria ter sido cobrada e não apareceu no extrato.`;
    case "POSSIBLE_DUPLICATE": {
      const nomes = Array.isArray(payload.names) ? payload.names.join(" e ") : "duas assinaturas";
      return `${nomes} parecem ser a mesma assinatura.`;
    }
    case "POSSIBLE_NEW_SUBSCRIPTION": {
      const desc = typeof payload.description === "string" ? payload.description : "Uma cobrança";
      const ocorrencias = typeof payload.occurrences === "number" ? payload.occurrences : 2;
      return `${desc} se repete (${ocorrencias}x) e ainda não é uma assinatura cadastrada.`;
    }
  }
}

/** Quanto desta movimentação é consumo seu — o número que o painel soma. */
export function personalConsumptionOf(transaction: VaultTransaction): number {
  return Number(transaction.personalConsumption);
}
