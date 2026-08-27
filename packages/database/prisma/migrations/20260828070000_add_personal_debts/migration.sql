-- Cofre Financeiro, fase 6: pessoas, dividas e baixas.
--
-- Aditiva: 3 tabelas e 1 enum. Nenhum DROP, nenhuma coluna alterada.
--
-- Nao existe coluna de valor pago, saldo nem status de divida -- os tres sao
-- derivados das baixas e da data de hoje. O motivo esta no comentario do model
-- PersonalDebt: uma divida vira atrasada pela passagem do tempo, e uma coluna
-- de status estaria errada toda madrugada.

-- CreateEnum
CREATE TYPE "personal_debt_direction" AS ENUM ('THEY_OWE_ME', 'I_OWE_THEM');
-- CreateTable
CREATE TABLE "personal_contacts" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "personal_contacts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "personal_debts" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "direction" "personal_debt_direction" NOT NULL,
    "description" TEXT NOT NULL,
    "original_amount" DECIMAL(14,2) NOT NULL,
    "currency" "personal_currency" NOT NULL DEFAULT 'BRL',
    "due_date" DATE,
    "origin_transaction_id" TEXT,
    "canceled_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "personal_debts_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "personal_debt_payments" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "debt_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paid_at" DATE NOT NULL,
    "transaction_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "personal_debt_payments_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "personal_contacts_vault_id_is_active_idx" ON "personal_contacts"("vault_id", "is_active");
-- CreateIndex
CREATE UNIQUE INDEX "personal_contacts_vault_id_name_key" ON "personal_contacts"("vault_id", "name");
-- CreateIndex
CREATE INDEX "personal_debts_vault_id_direction_idx" ON "personal_debts"("vault_id", "direction");
-- CreateIndex
CREATE INDEX "personal_debts_vault_id_due_date_idx" ON "personal_debts"("vault_id", "due_date");
-- CreateIndex
CREATE INDEX "personal_debts_vault_id_canceled_at_idx" ON "personal_debts"("vault_id", "canceled_at");
-- CreateIndex
CREATE INDEX "personal_debts_contact_id_idx" ON "personal_debts"("contact_id");
-- CreateIndex
CREATE INDEX "personal_debts_origin_transaction_id_idx" ON "personal_debts"("origin_transaction_id");
-- CreateIndex
CREATE UNIQUE INDEX "personal_debt_payments_transaction_id_key" ON "personal_debt_payments"("transaction_id");
-- CreateIndex
CREATE INDEX "personal_debt_payments_debt_id_idx" ON "personal_debt_payments"("debt_id");
-- CreateIndex
CREATE INDEX "personal_debt_payments_vault_id_paid_at_idx" ON "personal_debt_payments"("vault_id", "paid_at");
-- AddForeignKey
ALTER TABLE "personal_contacts" ADD CONSTRAINT "personal_contacts_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_debts" ADD CONSTRAINT "personal_debts_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_debts" ADD CONSTRAINT "personal_debts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "personal_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_debts" ADD CONSTRAINT "personal_debts_origin_transaction_id_fkey" FOREIGN KEY ("origin_transaction_id") REFERENCES "personal_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_debt_payments" ADD CONSTRAINT "personal_debt_payments_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_debt_payments" ADD CONSTRAINT "personal_debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "personal_debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "personal_debt_payments" ADD CONSTRAINT "personal_debt_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "personal_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Invariantes de dinheiro no banco, nao so no servico.
ALTER TABLE "personal_debts" ADD CONSTRAINT "personal_debts_amount_positive"
  CHECK ("original_amount" > 0);

ALTER TABLE "personal_debt_payments" ADD CONSTRAINT "personal_debt_payments_amount_positive"
  CHECK ("amount" > 0);

-- O que o banco NAO consegue garantir: que a soma das baixas nao ultrapasse o
-- valor da divida. Isso e uma invariante entre linhas de tabelas diferentes --
-- CHECK so enxerga a propria linha, e o gatilho necessario seria uma regra de
-- negocio escondida no banco, longe dos testes. Fica no servico, com teste.

-- RLS em toda tabela nova do schema public: o PostgREST do Supabase expoe
-- automaticamente o que existe aqui, e uma tabela sem RLS e uma tabela
-- publicamente legivel. Sem policy nenhuma = ninguem le por essa via; a API
-- entra pela connection string e passa por cima do RLS de proposito.
ALTER TABLE "personal_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_debts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_debt_payments" ENABLE ROW LEVEL SECURITY;
