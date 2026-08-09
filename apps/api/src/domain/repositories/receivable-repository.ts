import type { Receivable, ReceivableKind } from "../entities/receivable.js";

export interface CreatePlanItem {
  kind: ReceivableKind;
  installmentIndex: number;
  amount: string;
  dueDate: Date;
}

export interface CreateStandaloneItem {
  description: string;
  amount: string;
  dueDate: Date;
  /** Já resolvido pelo service (`new Date()` se `alreadyPaid`, senão null) --
   *  o repositório só persiste. */
  paidAt: Date | null;
}

export interface ReceivableRepository {
  /** Cria o plano numa transacao. Retorna null se o contrato ja tem QUALQUER parcela (plano existente). */
  createPlan(organizationId: string, contractId: string, items: CreatePlanItem[]): Promise<Receivable[] | null>;
  /** Receita avulsa: kind AVULSA, contractId null, installmentIndex sempre 0. */
  createStandalone(organizationId: string, item: CreateStandaloneItem): Promise<Receivable>;
  /** Avulsas da org (kind AVULSA), dueDate desc. */
  listStandalone(organizationId: string): Promise<Receivable[]>;
  listByContract(organizationId: string, contractId: string): Promise<Receivable[]>;
  findById(organizationId: string, id: string): Promise<Receivable | null>;
  /** CAS: marca paga so se paidAt null. Retorna null se ja paga/inexistente. */
  markPaid(organizationId: string, id: string, paidAt: Date, paidNote: string | null): Promise<Receivable | null>;
  /** CAS inverso: desfaz baixa so se paidAt nao-null. */
  markUnpaid(organizationId: string, id: string): Promise<Receivable | null>;
  /** So parcela em aberto. Retorna null se paga/inexistente. */
  update(organizationId: string, id: string, patch: { amount?: string; dueDate?: Date }): Promise<Receivable | null>;
  /** So parcela em aberto. False se paga/inexistente. */
  delete(organizationId: string, id: string): Promise<boolean>;
  hasPaid(organizationId: string, contractId: string): Promise<boolean>;
  deleteOpenByContract(organizationId: string, contractId: string): Promise<number>;
  /** Todas as parcelas da org no intervalo [from, to) por dueDate + todas em aberto vencidas antes de from. */
  listForSummary(organizationId: string, from: Date, to: Date): Promise<Receivable[]>;
  /** Parcelas da org com dueDate OU paidAt no intervalo [from, to) -- base
   *  bruta pra série mensal (bucketização em memória fica no service). */
  listForSeries(organizationId: string, from: Date, to: Date): Promise<Receivable[]>;
  /** Agregado por contrato: soma paga (para margem). */
  sumPaidByContract(organizationId: string, contractId: string): Promise<string>;
  /** Contratos da org que tem parcelas, com totais (pago/total/aberto) -- alimenta a listagem. */
  listContractsWithTotals(organizationId: string): Promise<
    Array<{
      contractId: string;
      numero: string;
      companyName: string;
      total: string;
      paid: string;
      openOverdue: string;
      nextDueDate: Date | null;
    }>
  >;
}
