export type ReceivableKind = "ENTRADA" | "PARCELA";

export interface Receivable {
  id: string;
  organizationId: string;
  contractId: string;
  kind: ReceivableKind;
  installmentIndex: number; // 0 = entrada, 1..N = parcelas
  amount: string; // Decimal serializa como string
  dueDate: Date;
  paidAt: Date | null;
  paidNote: string | null;
}
