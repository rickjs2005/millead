export type ReceivableKind = "ENTRADA" | "PARCELA" | "AVULSA";

export interface Receivable {
  id: string;
  organizationId: string;
  // Nullable desde a migração de receita avulsa (Task 1 do épico
  // financeiro-fechamento) -- ainda não consumido: os fluxos existentes
  // (plano de contrato) sempre passam contractId, então continuam
  // funcionando com string aqui.
  contractId: string | null;
  // Preenchida só em receita avulsa (kind AVULSA); parcelas de contrato
  // (ENTRADA/PARCELA) não usam este campo -- fica null.
  description: string | null;
  kind: ReceivableKind;
  installmentIndex: number; // 0 = entrada, 1..N = parcelas, avulsa sempre 0
  amount: string; // Decimal serializa como string
  dueDate: Date;
  paidAt: Date | null;
  paidNote: string | null;
}
