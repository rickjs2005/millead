/**
 * O que uma movimentação é, para efeito de "quanto entrou" e "quanto saiu".
 *
 * ## A regra que este arquivo existe pra defender
 *
 * **Um Pix recebido pra quitar uma dívida não é renda.** O dinheiro entra na
 * conta, mas o fato econômico já aconteceu antes — quando a compra foi feita e
 * virou dívida. Contar de novo na baixa é contagem dupla: o mês em que alguém
 * te devolve R$500 apareceria como um mês em que você ganhou R$500 a mais.
 *
 * O mesmo vale do outro lado: pagar uma dívida que eu devo **não é despesa
 * nova**. A despesa foi o empréstimo que entrou, não a devolução que sai.
 *
 * ## Por que uma função só, com quatro respostas
 *
 * Os quatro casos são mutuamente exclusivos por construção. Escrever
 * `contaComoReceita()` e `contaComoDespesa()` separados criaria dois lugares
 * pra manter a mesma regra, e a primeira divergência entre eles seria
 * silenciosa — os totais simplesmente parariam de fechar, sem erro nenhum.
 */

export type CashFlowKind = "INCOME" | "EXPENSE" | "TRANSFER" | "DEBT_SETTLEMENT";

export interface CashFlowInput {
  direction: "IN" | "OUT";
  /** Entre contas próprias ou pagamento de fatura: move dinheiro, não é fato novo. */
  isTransfer: boolean;
  /** Preenchido quando ESTA movimentação é a baixa de uma dívida. */
  settlesDebtId: string | null;
}

/**
 * A baixa é checada antes da transferência porque é o fato mais específico.
 * Na prática a ordem nunca decide nada: o serviço recusa vincular uma
 * transferência como baixa de dívida (transferência é entre contas suas, e uma
 * conta sua não te deve dinheiro), então as duas marcas não convivem.
 */
export function classifyCashFlow(input: CashFlowInput): CashFlowKind {
  if (input.settlesDebtId) return "DEBT_SETTLEMENT";
  if (input.isTransfer) return "TRANSFER";
  return input.direction === "IN" ? "INCOME" : "EXPENSE";
}

export function countsAsIncome(input: CashFlowInput): boolean {
  return classifyCashFlow(input) === "INCOME";
}

export function countsAsExpense(input: CashFlowInput): boolean {
  return classifyCashFlow(input) === "EXPENSE";
}

/** Texto curto pra tela explicar por que a movimentação está fora dos totais. */
export function cashFlowLabel(kind: CashFlowKind): string {
  switch (kind) {
    case "INCOME":
      return "Entrada";
    case "EXPENSE":
      return "Saída";
    case "TRANSFER":
      return "Transferência — não entra em receita nem em despesa";
    case "DEBT_SETTLEMENT":
      return "Baixa de dívida — não entra em receita nem em despesa";
  }
}
