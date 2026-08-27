import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type {
  BusinessExpense,
  BusinessExpenseRepository,
  CreateExpenseInput,
  ExpenseFilters,
  UpdateExpenseInput,
} from "../../domain/repositories/business-expense-repository.js";
import type { CostSubscriptionVerifier } from "../../domain/services/cost-subscription-verifier.js";
import { summarizeExpenses, type ExpenseSummary } from "./expense-summary.js";

/**
 * Despesas realizadas da MilWeb.
 *
 * O lado empresarial da ponte, e também um lançamento manual comum — nem toda
 * saída da empresa passa pelo cartão pessoal.
 *
 * ## O que este serviço NÃO faz
 *
 * Não mexe em `computeSummary`. O resumo de custos continua somando só os
 * **planos** (`CostSubscription`), e é isso que o mantém sendo uma previsão.
 * As despesas realizadas aparecem no seu próprio resumo, comparadas com o
 * plano lado a lado — ver `expense-summary.ts` sobre por que somar os dois
 * daria dois Claudes.
 */
export class BusinessExpenseService implements CostSubscriptionVerifier {
  constructor(
    private readonly expenses: BusinessExpenseRepository,
    private readonly costs: CostRepository,
  ) {}

  list(organizationId: string, filters: ExpenseFilters): Promise<BusinessExpense[]> {
    return this.expenses.list(organizationId, filters);
  }

  async get(organizationId: string, id: string): Promise<BusinessExpense> {
    const found = await this.expenses.findById(organizationId, id);
    if (!found) throw new NotFoundError("Despesa não encontrada.");
    return found;
  }

  async create(
    organizationId: string,
    input: Omit<CreateExpenseInput, "source">,
  ): Promise<BusinessExpense> {
    await this.assertPlanExists(organizationId, input.costSubscriptionId);
    return this.expenses.create(organizationId, { ...input, source: "MANUAL" });
  }

  async update(
    organizationId: string,
    id: string,
    patch: UpdateExpenseInput,
  ): Promise<BusinessExpense> {
    const atual = await this.get(organizationId, id);
    if (patch.costSubscriptionId !== undefined) {
      await this.assertPlanExists(organizationId, patch.costSubscriptionId);
    }

    // Despesa vinda do Cofre tem o valor governado pelo rateio da compra: mudar
    // aqui criaria duas versões da mesma verdade, e o próximo "sincronizar"
    // desfaria a edição sem avisar. O caminho é corrigir o rateio no Cofre.
    if (atual.source === "PERSONAL_VAULT" && patch.amount !== undefined) {
      throw new ValidationError(
        "O valor desta despesa vem do rateio da compra que a originou. " +
          "Ajuste o rateio na origem e sincronize — editar aqui seria desfeito na próxima sincronização.",
      );
    }

    const updated = await this.expenses.update(organizationId, id, patch);
    if (!updated) throw new NotFoundError("Despesa não encontrada.");
    return updated;
  }

  /**
   * Apagar uma despesa vinda do Cofre é permitido, e desfaz o envio.
   *
   * O elo cai por Cascade, e a compra volta a aparecer como "não enviada" no
   * Cofre — que é a verdade. A alternativa (recusar com 409 apontando pra um
   * Cofre que quem está no financeiro não pode ver) seria um erro impossível de
   * resolver de onde a pessoa está.
   */
  async delete(organizationId: string, id: string): Promise<void> {
    const deleted = await this.expenses.delete(organizationId, id);
    if (!deleted) throw new NotFoundError("Despesa não encontrada.");
  }

  async summary(organizationId: string, range: { from: Date; to: Date }): Promise<ExpenseSummary> {
    const [despesas, planos, settings] = await Promise.all([
      this.expenses.list(organizationId, {
        from: range.from,
        to: range.to,
        costSubscriptionId: null,
        source: null,
      }),
      this.costs.listSubscriptions(organizationId),
      this.costs.getSettings(organizationId),
    ]);

    return summarizeExpenses(
      despesas.map((e) => ({
        id: e.id,
        costSubscriptionId: e.costSubscriptionId,
        amount: Number(e.amount),
        currency: e.currency,
        source: e.source,
      })),
      planos.map((p) => ({
        id: p.id,
        name: p.name,
        amount: Number(p.amount),
        currency: p.currency,
        billingCycle: p.billingCycle,
        isActive: p.isActive,
      })),
      Number(settings.usdToBrlRate),
    );
  }

  // ----- Porta CostSubscriptionVerifier -----

  costSubscriptionExists(organizationId: string, costSubscriptionId: string): Promise<boolean> {
    return this.expenses.costSubscriptionExists(organizationId, costSubscriptionId);
  }

  private async assertPlanExists(
    organizationId: string,
    costSubscriptionId: string | null | undefined,
  ): Promise<void> {
    if (!costSubscriptionId) return;
    const existe = await this.expenses.costSubscriptionExists(organizationId, costSubscriptionId);
    if (!existe) throw new ValidationError("Assinatura de custo não encontrada nesta organização.");
  }
}
