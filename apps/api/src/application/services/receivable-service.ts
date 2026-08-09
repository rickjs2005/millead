import type { Receivable } from "../../domain/entities/receivable.js";
import { ConflictError, NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { ContractRepository } from "../../domain/repositories/contract-repository.js";
import type {
  CreatePlanItem,
  ReceivableRepository,
} from "../../domain/repositories/receivable-repository.js";
import type {
  CreatePlanInput,
  CreateStandaloneInput,
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

/** Ponto da série mensal -- `expected` conta por `dueDate` (pago ou não),
 *  `received` por `paidAt`. Uma mesma parcela pode contribuir pra `expected`
 *  de um mês e `received` de outro (venceu em julho, foi paga em agosto). */
export interface ReceivableSeriesPoint {
  month: string;
  received: string;
  expected: string;
}

export interface ReceivableSeries {
  months: ReceivableSeriesPoint[]; // exatamente N entradas, ordem cronológica asc, zero-fill
  yearTotals: { year: number; received: string; expected: string };
}

/** Tolerância pra bater a soma de entrada+parcelas com o total informado --
 *  cobre arredondamento de centavos (ex.: 3 parcelas de total não-divisível
 *  por 3, onde o front já distribuiu o resto na última). */
const SUM_TOLERANCE = 0.01;

/**
 * Dois campos, dois cortes -- essa é a parte não óbvia do domínio:
 *
 * - `dueDate` é DATE-ONLY: vem de `<input type="date">` no front
 *   (plan-dialog.tsx) e é coagido por `z.coerce.date()` (ver
 *   receivable.dto.ts) pra SEMPRE `YYYY-MM-DDT00:00:00Z` -- não existe
 *   "hora de Brasília" pra essa data, é só um dia do calendário. Corte em
 *   meia-noite UTC (`monthRangeUtc`/`monthKeyUtc`) é o que faz "vence dia 1"
 *   cair no mês do dia 1 -- aplicar o corte de Brasília aqui empurraria todo
 *   vencimento dia 1 (padrão comum de cobrança) pro mês anterior.
 * - `paidAt` é TIMESTAMP REAL: default `new Date()` no momento da baixa (ver
 *   `pay()` abaixo) -- representa quando o pagamento de fato aconteceu, no
 *   fuso de quem opera o sistema (Brasília). Corte em meia-noite de Brasília
 *   (`monthRangeSp`/`monthKeySp`) é o certo aqui.
 *
 * Brasil aboliu horário de verão em 2019; America/Sao_Paulo é UTC-3 fixo o
 * ano inteiro. Meia-noite de Brasília = 03:00 UTC. Se o DST voltar, este é
 * o único lugar a ajustar (nesta cópia).
 */
const SP_UTC_OFFSET_HOURS = 3;

/** Intervalo [from, to) em UTC pra filtrar `dueDate` (date-only, sem fuso)
 *  de um mês "YYYY-MM" -- corte em meia-noite UTC pura. */
function monthRangeUtc(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1)),
  };
}

/** Intervalo [from, to) em UTC pra filtrar `paidAt` (timestamp real) de um
 *  mês "YYYY-MM", cortado em meia-noite de Brasília (não meia-noite UTC). */
function monthRangeSp(month: string): { from: Date; to: Date } {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  return {
    from: new Date(Date.UTC(year, monthIndex, 1, SP_UTC_OFFSET_HOURS, 0, 0)),
    to: new Date(Date.UTC(year, monthIndex + 1, 1, SP_UTC_OFFSET_HOURS, 0, 0)),
  };
}

/** Lista N chaves "YYYY-MM" em ordem cronológica ascendente terminando em
 *  `endMonth` (inclusive) -- monta o eixo X zero-filled da série. */
function monthKeysAsc(endMonth: string, count: number): string[] {
  const [yearStr, monthStr] = endMonth.split("-");
  let year = Number(yearStr);
  let monthIndex = Number(monthStr) - 1; // 0-based
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }
  return keys.reverse();
}

/** Chave "YYYY-MM" de uma data em UTC puro -- usar SÓ com `dueDate`
 *  (date-only, ver comentário de `monthRangeUtc`/`monthRangeSp` acima). */
function monthKeyUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Chave "YYYY-MM" de uma data, bucketizada em America/Sao_Paulo -- desloca
 *  o timestamp -3h (mesmo corte de `monthRangeSp`) antes de extrair ano/mês
 *  em UTC, senão um pagamento das 21h-23h59 de Brasília cairia no mês UTC
 *  seguinte. Usar SÓ com `paidAt` (timestamp real). */
function monthKeySp(date: Date): string {
  const spShifted = new Date(date.getTime() - SP_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  return `${spShifted.getUTCFullYear()}-${String(spShifted.getUTCMonth() + 1).padStart(2, "0")}`;
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

    // O total do plano precisa bater com o valor assinado do contrato -- sem
    // essa checagem dava pra criar um plano com soma internamente consistente
    // mas totalmente divergente do que foi fechado (ex.: contrato de 50k,
    // plano de 5k, tudo "válido" porque só a soma interna era conferida).
    const contractTotal = Number(contract.valorTotal);
    const contractDiff = Math.round((input.total - contractTotal) * 100) / 100;
    if (Math.abs(contractDiff) > SUM_TOLERANCE) {
      throw new ValidationError(
        `O total do plano (${input.total.toFixed(2)}) difere do valor do contrato (${contractTotal.toFixed(2)}) em ${Math.abs(contractDiff).toFixed(2)}.`,
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

  /** Receita avulsa: sem contrato, kind AVULSA, installmentIndex 0 (fixado
   *  no repositório). `alreadyPaid` resolve pra `paidAt = new Date()` --
   *  regime de caixa, mesmo timestamp-real que `pay()` usa. */
  createStandalone(organizationId: string, input: CreateStandaloneInput): Promise<Receivable> {
    return this.receivables.createStandalone(organizationId, {
      description: input.description,
      amount: input.amount.toFixed(2),
      dueDate: input.dueDate,
      paidAt: input.alreadyPaid ? new Date() : null,
    });
  }

  listStandalone(organizationId: string): Promise<Receivable[]> {
    return this.receivables.listStandalone(organizationId);
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
    // dueDate (toReceive) é date-only -- corte UTC. paidAt (received) é
    // timestamp real -- corte de Brasília. Ver comentário em `monthRangeUtc`.
    const { from: fromUtc, to: toUtc } = monthRangeUtc(resolvedMonth);
    const { from: fromSp, to: toSp } = monthRangeSp(resolvedMonth);
    const now = new Date();

    // fromUtc <= fromSp e toUtc <= toSp sempre (offset fixo positivo) -- a
    // união das duas janelas ([fromUtc, toSp)) cobre os dois cortes; o repo
    // só precisa trazer candidatos, a classificação exata por campo
    // acontece no loop abaixo.
    const rows = await this.receivables.listForSummary(organizationId, fromUtc, toSp);

    let toReceive = 0;
    let received = 0;
    let overdue = 0;
    const overdueItems: Receivable[] = [];

    for (const row of rows) {
      if (row.paidAt) {
        if (row.paidAt >= fromSp && row.paidAt < toSp) {
          received += Number(row.amount);
        }
        continue;
      }

      if (row.dueDate < now) {
        overdue += Number(row.amount);
        overdueItems.push(row);
        continue;
      }

      if (row.dueDate >= fromUtc && row.dueDate < toUtc) {
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

  /** Série mensal (últimos `months`, default 12) recebido x esperado, mais
   *  totais do ano corrente -- alimenta gráfico de fluxo de caixa. */
  async series(organizationId: string, months = 12): Promise<ReceivableSeries> {
    const currentMonth = currentMonthInTimeZone();
    const keys = monthKeysAsc(currentMonth, months);

    // expected (dueDate, date-only) -- corte UTC. Só o `from` do primeiro mês
    // importa pra janela de busca (o `to` do mês corrente nunca é o extremo
    // mais tardio -- ver comentário abaixo).
    const { from: fromUtc } = monthRangeUtc(keys[0]!);
    // received (paidAt, timestamp real) -- corte de Brasília. Só o `to` do
    // mês corrente importa (mesmo raciocínio, extremo oposto).
    const { to: toSp } = monthRangeSp(currentMonth);

    const currentYear = Number(currentMonth.split("-")[0]);
    const yearFromUtc = new Date(Date.UTC(currentYear, 0, 1));
    const yearToUtc = new Date(Date.UTC(currentYear + 1, 0, 1));
    const yearFromSp = new Date(Date.UTC(currentYear, 0, 1, SP_UTC_OFFSET_HOURS, 0, 0));
    const yearToSp = new Date(Date.UTC(currentYear + 1, 0, 1, SP_UTC_OFFSET_HOURS, 0, 0));

    // A janela de busca precisa cobrir os N meses da série E o ano corrente
    // inteiro (quando months < 12 um intervalo não contém o outro) E os dois
    // cortes (UTC pra dueDate, Brasília pra paidAt). UTC é sempre <= Brasília
    // (offset fixo positivo), então o mínimo global sempre vem de um `*Utc`
    // e o máximo global sempre vem de um `*Sp` -- daí só precisar de
    // `fromUtc`/`toSp` aqui (o `toUtc` da janela de meses nunca supera
    // `toSp` do mesmo mês, e o `fromSp` nunca é menor que `fromUtc`). O repo
    // só precisa trazer candidatos; a classificação exata por campo
    // acontece no loop abaixo.
    const queryFrom = fromUtc < yearFromUtc ? fromUtc : yearFromUtc;
    const queryTo = toSp > yearToSp ? toSp : yearToSp;

    const rows = await this.receivables.listForSeries(organizationId, queryFrom, queryTo);

    const buckets = new Map<string, { received: number; expected: number }>();
    for (const key of keys) buckets.set(key, { received: 0, expected: 0 });

    let yearReceived = 0;
    let yearExpected = 0;

    for (const row of rows) {
      const amount = Number(row.amount);

      if (row.paidAt) {
        const bucket = buckets.get(monthKeySp(row.paidAt));
        if (bucket) bucket.received += amount;
        if (row.paidAt >= yearFromSp && row.paidAt < yearToSp) yearReceived += amount;
      }

      const dueBucket = buckets.get(monthKeyUtc(row.dueDate));
      if (dueBucket) dueBucket.expected += amount;
      if (row.dueDate >= yearFromUtc && row.dueDate < yearToUtc) yearExpected += amount;
    }

    return {
      months: keys.map((key) => {
        const bucket = buckets.get(key)!;
        return { month: key, received: bucket.received.toFixed(2), expected: bucket.expected.toFixed(2) };
      }),
      yearTotals: {
        year: currentYear,
        received: yearReceived.toFixed(2),
        expected: yearExpected.toFixed(2),
      },
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
