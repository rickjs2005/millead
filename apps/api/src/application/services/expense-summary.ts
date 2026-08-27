import { monthlyAmountBrl } from "./cost-service.js";

/**
 * Planejado x realizado — lado a lado, **nunca somados**.
 *
 * ## O erro que este arquivo existe pra impedir
 *
 * `CostSubscription` é o **plano**: "o Claude custa US$20/mês". É ele que
 * entra em `computeSummary`, e o resultado é uma previsão do que a MilWeb
 * gasta por mês.
 *
 * `BusinessExpense` é o **realizado**: "no dia 05/08 saíram R$120 do cartão".
 *
 * Os dois descrevem o mesmo Claude. Somar daria R$230/mês de Claude — o custo
 * da agência dobraria da noite pro dia, e o número errado seria plausível o
 * bastante pra ninguém desconfiar. Por isso **nenhuma função aqui devolve a
 * soma dos dois**: o que existe é `diferencaBrl`, que é `realizado −
 * planejado`, e diz outra coisa (estourou ou sobrou).
 *
 * Pela mesma razão a despesa realizada não entra em `computeSummary`, e há
 * teste fixando isso: criar despesas não pode mexer no `totalMonthlyBrl`.
 */

type Currency = "BRL" | "USD";
type Cycle = "MONTHLY" | "YEARLY";

export interface PlanForComparison {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  billingCycle: Cycle;
  isActive: boolean;
}

export interface ExpenseForSummary {
  id: string;
  costSubscriptionId: string | null;
  amount: number;
  currency: Currency;
  /** Origem: o financeiro mostra de onde veio, e só isso. */
  source: "MANUAL" | "PERSONAL_VAULT";
}

export interface PlanComparison {
  costSubscriptionId: string;
  name: string;
  planejadoBrl: number;
  realizadoBrl: number;
  /** `realizado − planejado`. Positivo = estourou; negativo = sobrou. */
  diferencaBrl: number;
  lancamentos: number;
}

export interface ExpenseSummary {
  /** Total do que saiu no período. */
  realizadoBrl: number;
  /** Total dos planos ativos, mensalizado. Existe pra ser COMPARADO, não
   *  somado — ver o comentário no topo. */
  planejadoBrl: number;
  /** Quanto do realizado veio do Cofre pessoal (a empresa deve isso ao dono). */
  doCofreBrl: number;
  porPlano: PlanComparison[];
  semPlano: { realizadoBrl: number; lancamentos: number };
}

/**
 * Valor da despesa em reais.
 *
 * Despesa vinda do Cofre é **sempre** BRL, e isso é deliberado: o Cofre já
 * sabe o que de fato saiu da conta em reais, com IOF e spread do dia. Converter
 * de novo pela cotação de hoje reescreveria o passado toda vez que o dólar
 * mexesse — o mesmo motivo pelo qual `unitPriceBrl` é congelado no
 * `CostUsageEntry`.
 */
function expenseBrl(expense: ExpenseForSummary, usdRate: number): number {
  return expense.currency === "USD" ? expense.amount * usdRate : expense.amount;
}

export function summarizeExpenses(
  expenses: readonly ExpenseForSummary[],
  plans: readonly PlanForComparison[],
  usdRate: number,
): ExpenseSummary {
  const ativos = plans.filter((p) => p.isActive);

  const porPlanoMap = new Map<string, { realizadoBrl: number; lancamentos: number }>();
  let realizadoBrl = 0;
  let doCofreBrl = 0;
  const semPlano = { realizadoBrl: 0, lancamentos: 0 };

  for (const expense of expenses) {
    const brl = expenseBrl(expense, usdRate);
    realizadoBrl += brl;
    if (expense.source === "PERSONAL_VAULT") doCofreBrl += brl;

    if (expense.costSubscriptionId) {
      const acc = porPlanoMap.get(expense.costSubscriptionId) ?? {
        realizadoBrl: 0,
        lancamentos: 0,
      };
      acc.realizadoBrl += brl;
      acc.lancamentos += 1;
      porPlanoMap.set(expense.costSubscriptionId, acc);
    } else {
      semPlano.realizadoBrl += brl;
      semPlano.lancamentos += 1;
    }
  }

  // Todo plano ativo aparece, mesmo sem despesa: "planejado R$110, realizado
  // R$0" é informação — significa que a cobrança do mês ainda não entrou (ou
  // não foi lançada). Omitir a linha esconderia isso.
  const porPlano: PlanComparison[] = ativos.map((plan) => {
    const real = porPlanoMap.get(plan.id) ?? { realizadoBrl: 0, lancamentos: 0 };
    const planejadoBrl = monthlyAmountBrl(plan.amount, plan.currency, plan.billingCycle, usdRate);
    return {
      costSubscriptionId: plan.id,
      name: plan.name,
      planejadoBrl,
      realizadoBrl: real.realizadoBrl,
      diferencaBrl: real.realizadoBrl - planejadoBrl,
      lancamentos: real.lancamentos,
    };
  });

  // Despesa apontando pra plano inativo ou apagado ainda precisa aparecer em
  // algum lugar, senão o total não bate com a soma das linhas.
  for (const [id, real] of porPlanoMap) {
    if (porPlano.some((p) => p.costSubscriptionId === id)) continue;
    semPlano.realizadoBrl += real.realizadoBrl;
    semPlano.lancamentos += real.lancamentos;
  }

  const planejadoBrl = ativos.reduce(
    (acc, p) => acc + monthlyAmountBrl(p.amount, p.currency, p.billingCycle, usdRate),
    0,
  );

  return {
    realizadoBrl,
    planejadoBrl,
    doCofreBrl,
    porPlano: porPlano.sort((a, b) => b.diferencaBrl - a.diferencaBrl),
    semPlano,
  };
}
