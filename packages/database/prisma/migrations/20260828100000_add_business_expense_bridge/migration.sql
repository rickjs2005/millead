-- Cofre Financeiro, fase 7: ponte com o financeiro da MilWeb.
--
-- Aditiva: 2 tabelas e 1 enum. Nenhum DROP, nenhuma coluna alterada.
--
-- `business_expenses` e o REALIZADO da empresa; `cost_subscriptions` continua
-- sendo o PLANEJADO. As duas nao se somam em lugar nenhum -- somar daria dois
-- Claudes. Ver expense-summary.ts.
--
-- `personal_business_allocations` e a unica tabela que sabe os dois lados. E
-- por isso que a despesa empresarial NAO tem coluna apontando pro Cofre: quem
-- ve o financeiro nao chega na movimentacao pessoal.

-- CreateEnum
CREATE TYPE "business_expense_source" AS ENUM ('MANUAL', 'PERSONAL_VAULT');
-- CreateTable
CREATE TABLE "business_expenses" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "cost_currency" NOT NULL DEFAULT 'BRL',
    "incurred_at" DATE NOT NULL,
    "category" "cost_category" NOT NULL DEFAULT 'OTHER',
    "cost_subscription_id" TEXT,
    "company_id" TEXT,
    "source" "business_expense_source" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "business_expenses_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "personal_business_allocations" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "business_expense_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "personal_business_allocations_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "business_expenses_organization_id_incurred_at_idx" ON "business_expenses"("organization_id", "incurred_at");
-- CreateIndex
CREATE INDEX "business_expenses_organization_id_cost_subscription_id_idx" ON "business_expenses"("organization_id", "cost_subscription_id");
-- CreateIndex
CREATE INDEX "business_expenses_company_id_idx" ON "business_expenses"("company_id");
-- CreateIndex
CREATE UNIQUE INDEX "personal_business_allocations_transaction_id_key" ON "personal_business_allocations"("transaction_id");
-- CreateIndex
CREATE UNIQUE INDEX "personal_business_allocations_business_expense_id_key" ON "personal_business_allocations"("business_expense_id");
-- CreateIndex
CREATE INDEX "personal_business_allocations_vault_id_idx" ON "personal_business_allocations"("vault_id");
-- AddForeignKey
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_cost_subscription_id_fkey" FOREIGN KEY ("cost_subscription_id") REFERENCES "cost_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_business_allocations" ADD CONSTRAINT "personal_business_allocations_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_business_allocations" ADD CONSTRAINT "personal_business_allocations_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "personal_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_business_allocations" ADD CONSTRAINT "personal_business_allocations_business_expense_id_fkey" FOREIGN KEY ("business_expense_id") REFERENCES "business_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invariantes de dinheiro no banco.
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "personal_business_allocations" ADD CONSTRAINT "personal_business_allocations_amount_positive"
  CHECK ("amount" > 0);

-- RLS nas duas.
--
-- `business_expenses` e do mundo multi-tenant, e ate hoje as tabelas de la
-- dependem do filtro por organization_id na aplicacao. Ligar RLS aqui nao
-- muda esse desenho: sem policy nenhuma, o PostgREST do Supabase simplesmente
-- nao le a tabela, e a API entra pela connection string. E a mesma rede de
-- seguranca que o ensure-rls.sql aplica em toda tabela nova.
ALTER TABLE "business_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_business_allocations" ENABLE ROW LEVEL SECURITY;
