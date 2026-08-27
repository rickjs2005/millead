/**
 * Despesas realizadas da MilWeb e o elo com o Cofre pessoal.
 *
 * Os dois no mesmo contrato porque a ponte é uma operação só: criar a despesa e
 * gravar o elo têm de acontecer juntos ou não acontecer — uma despesa sem elo
 * seria enviada de novo no próximo clique, e um elo sem despesa apontaria pra
 * nada. Separar em dois repositórios convidaria a gravar metade.
 *
 * Dinheiro em **string decimal** aqui, e não em centavos: o lado empresarial
 * inteiro (custos, assinaturas, cotação) trabalha assim, e converter na
 * fronteira só pra converter de volta seria um passo a mais onde errar.
 */

export type BusinessExpenseSource = "MANUAL" | "PERSONAL_VAULT";
export type CostCurrency = "BRL" | "USD";
export type CostCategory =
  "HOSTING" | "DATABASE" | "AI" | "DOMAIN" | "EMAIL" | "SIGNATURE" | "OTHER";

export interface BusinessExpense {
  id: string;
  organizationId: string;
  description: string;
  amount: string;
  currency: CostCurrency;
  incurredAt: Date;
  category: CostCategory;
  costSubscriptionId: string | null;
  companyId: string | null;
  source: BusinessExpenseSource;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpenseInput {
  description: string;
  amount: string;
  currency: CostCurrency;
  incurredAt: Date;
  category: CostCategory;
  costSubscriptionId: string | null;
  companyId: string | null;
  source: BusinessExpenseSource;
  notes: string | null;
}

export type UpdateExpenseInput = Partial<Omit<CreateExpenseInput, "source">>;

export interface ExpenseFilters {
  from: Date | null;
  to: Date | null;
  costSubscriptionId: string | null;
  source: BusinessExpenseSource | null;
}

/** O elo — só o Cofre lê. Ver o comentário do model sobre por quê. */
export interface BusinessAllocation {
  id: string;
  vaultId: string;
  transactionId: string;
  businessExpenseId: string;
  organizationId: string;
  amount: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessExpenseRepository {
  // ----- Lado empresarial -----
  list(organizationId: string, filters: ExpenseFilters): Promise<BusinessExpense[]>;
  findById(organizationId: string, id: string): Promise<BusinessExpense | null>;
  create(organizationId: string, input: CreateExpenseInput): Promise<BusinessExpense>;
  update(
    organizationId: string,
    id: string,
    patch: UpdateExpenseInput,
  ): Promise<BusinessExpense | null>;
  delete(organizationId: string, id: string): Promise<boolean>;

  /** A assinatura de custo existe **nesta** organização? É a checagem que
   *  impede apontar uma despesa (ou uma assinatura pessoal) pra um plano de
   *  outra organização — não há FK entre os dois mundos que faça isso. */
  costSubscriptionExists(organizationId: string, costSubscriptionId: string): Promise<boolean>;

  // ----- Ponte -----

  /**
   * Cria a despesa e o elo numa transação de banco só.
   *
   * Método próprio, e não `create` + `linkAllocation` soltos: entre uma
   * chamada e outra o processo pode morrer (Render free reinicia sozinho), e o
   * que sobraria é uma despesa empresarial sem elo — que o Cofre não reconhece
   * como enviada e mandaria de novo, dobrando o custo.
   */
  createWithAllocation(
    organizationId: string,
    vaultId: string,
    transactionId: string,
    input: CreateExpenseInput,
  ): Promise<{ expense: BusinessExpense; allocation: BusinessAllocation }>;

  findAllocationByTransaction(
    vaultId: string,
    transactionId: string,
  ): Promise<BusinessAllocation | null>;
  listAllocations(vaultId: string): Promise<BusinessAllocation[]>;

  /** Atualiza o valor enviado e o da despesa, juntos — pelo mesmo motivo do
   *  `createWithAllocation`. */
  syncAllocation(
    vaultId: string,
    transactionId: string,
    amount: string,
    patch: UpdateExpenseInput,
  ): Promise<{ expense: BusinessExpense; allocation: BusinessAllocation } | null>;

  /** Desfaz o envio: apaga a despesa; o elo cai junto pelo Cascade. */
  revertAllocation(vaultId: string, transactionId: string): Promise<boolean>;
}
