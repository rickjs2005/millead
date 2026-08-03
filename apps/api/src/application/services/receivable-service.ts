import type { Receivable } from "../../domain/entities/receivable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type {
  CreatePlanItem,
  ReceivableRepository,
} from "../../domain/repositories/receivable-repository.js";
import type {
  CreatePlanInput,
  PayInput,
  UpdateReceivableInput,
} from "../dto/receivable.dto.js";
import { currentMonthInTimeZone } from "./cost-service.js";
import type { EstimateService } from "./estimate-service.js";

/** Contrato + totais agregados de parcelas -- alimenta a listagem de contratos
 *  com parcelas (espelha `ReceivableRepository.listContractsWithTotals`). */
export interface ContractWithTotals {
  contractId: string;
  numero: string;
  companyName: string;
  total: string;
  paid: string;
  openOverdue: string;
  nextDueDate: Date | null;
}

export interface ReceivableSummary {
  month: string;
  toReceive: string; // em aberto com vencimento no mês
  overdue: string; // em aberto vencidas (qualquer data passada)
  overdueItems: Receivable[];
  received: string; // pagas com paidAt no mês
}

export interface ContractMargin {
  contractId: string;
  soldValue: string; // contract.valorTotal
  received: string; // soma paga
  projectedCost: string | null; // null se contrato sem proposalId/orçamento
  realizedMargin: string | null; // received - projectedCost (null se sem custo)
}

/** Tolerância pra bater a soma de entrada+parcelas com o total informado --
 *  cobre arredondamento de centavos (ex.: 3 parcelas de total não-divisível
 *  por 3, onde o front já distribuiu o resto na última). */
const SUM_TOLERANCE = 0.01;

/** Intervalo [from, to) em UTC pra filtrar `dueDate`/`paidAt` de um mês
 *  "YYYY-MM" -- mesmo padrão do cost-service (usage/getUsageSummary). */
function monthRangeUtc(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

export class ReceivableService {
  constructor(
    private readonly receivables: ReceivableRepository,
    private readonly contracts: ContractRepository,
    private readonly estimateService: Pick<EstimateService, "projectedCostByProposalId">,
  ) {}

  async createPlan(organizationId: string, input: CreatePlanInput): Promise<Receivable[]> {
    const contract = await this.contracts.findByIdForOrg(input.contractId, organizationId);
    if (!contract) throw new NotFoundError("Contrato não encontrado.");

    const installmentsSum = input.installments.reduce((acc, item) => acc + item.amount, 0);
    const sum = input.entryAmount + installmentsSum;
    const diff = Math.round((sum - input.total) * 100) / 100;
    if (Math.abs(diff) > SUM_TOLERANCE) {
      throw new ValidationError(
        `A soma da entrada + parcelas (${sum.toFixed(2)}) difere do total (${input.total.toFixed(2)}) em ${Math.abs(diff).toFixed(2)}.`,
      );
    }

    const hasPaid = await this.receivables.hasPaid(organizationId, input.contractId);
    if (hasPaid) {
      throw new ConflictError("Este contrato já possui parcela paga; não é possível recriar o plano.");
    }

    // Sem parcela paga: qualquer plano existente é só "em aberto" -- limpa
    // antes de criar o novo (recriação do plano).
    await this.receivables.deleteOpenByContract(organizationId, input.contractId);

    const items: CreatePlanItem[] = [];
    if (input.entryAmount > 0) {
      items.push({
        kind: "ENTRADA",
        installmentIndex: 0,
        amount: input.entryAmount.toFixed(2),
        dueDate: input.entryDueDate,
      });
    }
    input.installments.forEach((installment, index) => {
      items.push({
        kind: "PARCELA",
        installmentIndex: index + 1,
        amount: installment.amount.toFixed(2),
        dueDate: installment.dueDate,
      });
    });

    const created = await this.receivables.createPlan(organizationId, input.contractId, items);
    if (!created) {
      // Corrida rara: outra chamada criou parcela entre o hasPaid e aqui.
      throw new ConflictError("Este contrato já possui um plano de parcelas.");
    }
    return created;
  }

  listByContract(organizationId: string, contractId: string): Promise<Receivable[]> {
    return this.receivables.listByContract(organizationId, contractId);
  }

  async pay(organizationId: string, id: string, input: PayInput): Promise<Receivable> {
    const existing = await this.receivables.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Parcela não encontrada.");
    if (existing.paidAt) throw new ConflictError("Parcela já paga.");

    const updated = await this.receivables.markPaid(
      organizationId,
      id,
      input.paidAt ?? new Date(),
      input.paidNote ?? null,
    );
    if (!updated) throw new ConflictError("Parcela já paga.");
    return updated;
  }

  async unpay(organizationId: string, id: string): Promise<Receivable> {
    const existing = await this.receivables.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Parcela não encontrada.");
    if (!existing.paidAt) throw new ConflictError("Parcela não está paga.");

    const updated = await this.receivables.markUnpaid(organizationId, id);
    if (!updated) throw new ConflictError("Parcela não está paga.");
    return updated;
  }

  async update(organizationId: string, id: string, patch: UpdateReceivableInput): Promise<Receivable> {
    const existing = await this.receivables.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Parcela não encontrada.");
    if (existing.paidAt) throw new ConflictError("Parcela paga não pode ser alterada.");

    const updated = await this.receivables.update(organizationId, id, {
      amount: patch.amount != null ? patch.amount.toFixed(2) : undefined,
      dueDate: patch.dueDate,
    });
    if (!updated) throw new ConflictError("Parcela paga não pode ser alterada.");
    return updated;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const existing = await this.receivables.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Parcela não encontrada.");
    if (existing.paidAt) throw new ConflictError("Parcela paga não pode ser excluída.");

    const ok = await this.receivables.delete(organizationId, id);
    if (!ok) throw new ConflictError("Parcela paga não pode ser excluída.");
  }

  /** `month` default: mês atual em America/Sao_Paulo (mesmo padrão do
   *  cost-service). `overdue` é "qualquer data passada" -- não se limita ao
   *  mês consultado (uma parcela vencida em maio some no resumo de agosto). */
  async summary(organizationId: string, month?: string): Promise<ReceivableSummary> {
    const resolvedMonth = month ?? currentMonthInTimeZone();
    const { from, to } = monthRangeUtc(resolvedMonth);
    const now = new Date();

    const rows = await this.receivables.listForSummary(organizationId, from, to);

    let toReceive = 0;
    let received = 0;
    let overdue = 0;
    const overdueItems: Receivable[] = [];

    for (const row of rows) {
      if (row.paidAt) {
        if (row.paidAt >= from && row.paidAt < to) {
          received += Number(row.amount);
        }
        continue;
      }

      if (row.dueDate < now) {
        overdue += Number(row.amount);
        overdueItems.push(row);
        continue;
      }

      if (row.dueDate >= from && row.dueDate < to) {
        toReceive += Number(row.amount);
      }
    }

    return {
      month: resolvedMonth,
      toReceive: toReceive.toFixed(2),
      overdue: overdue.toFixed(2),
      overdueItems,
      received: received.toFixed(2),
    };
  }

  listContracts(organizationId: string): Promise<ContractWithTotals[]> {
    return this.receivables.listContractsWithTotals(organizationId);
  }

  async margin(organizationId: string, contractId: string): Promise<ContractMargin> {
    const contract = await this.contracts.findByIdForOrg(contractId, organizationId);
    if (!contract) throw new NotFoundError("Contrato não encontrado.");

    const [received, projectedCost] = await Promise.all([
      this.receivables.sumPaidByContract(organizationId, contractId),
      contract.proposalId
        ? this.estimateService.projectedCostByProposalId(organizationId, contract.proposalId)
        : Promise.resolve(null),
    ]);

    const realizedMargin =
      projectedCost != null ? (Number(received) - projectedCost).toFixed(2) : null;

    return {
      contractId,
      soldValue: contract.valorTotal,
      received,
      projectedCost: projectedCost != null ? projectedCost.toFixed(2) : null,
      realizedMargin,
    };
  }
}
