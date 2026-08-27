-- Cofre Financeiro, fase 5: assinaturas e alertas.
--
-- Aditiva: 2 tabelas, 4 enums e 2 colunas anulaveis (subscription_id em
-- personal_transactions, set_subscription_id nas regras). Nenhum DROP.

-- CreateEnum
CREATE TYPE "personal_subscription_period" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "personal_subscription_status" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELED');

-- CreateEnum
CREATE TYPE "personal_alert_type" AS ENUM ('RENEWS_TODAY', 'RENEWS_TOMORROW', 'RENEWS_IN_3_DAYS', 'RENEWS_IN_7_DAYS', 'PRICE_CHANGED', 'POSSIBLE_DUPLICATE', 'MISSING_CHARGE', 'POSSIBLE_NEW_SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "personal_alert_status" AS ENUM ('PENDING', 'READ', 'SNOOZED');

-- AlterTable
ALTER TABLE "personal_classification_rules" ADD COLUMN     "set_subscription_id" TEXT;

-- AlterTable
ALTER TABLE "personal_transactions" ADD COLUMN     "subscription_id" TEXT;

-- CreateTable
CREATE TABLE "personal_subscriptions" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "merchant_id" TEXT,
    "category_id" TEXT,
    "account_id" TEXT,
    "card_id" TEXT,
    "expected_amount" DECIMAL(14,2) NOT NULL,
    "currency" "personal_currency" NOT NULL DEFAULT 'BRL',
    "period" "personal_subscription_period" NOT NULL DEFAULT 'MONTHLY',
    "custom_interval_days" INTEGER,
    "last_charge_at" DATE,
    "next_renewal_at" DATE,
    "alert_days_before" INTEGER NOT NULL DEFAULT 7,
    "price_tolerance_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "status" "personal_subscription_status" NOT NULL DEFAULT 'ACTIVE',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "cost_subscription_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_subscription_alerts" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "transaction_id" TEXT,
    "type" "personal_alert_type" NOT NULL,
    "reference_date" DATE NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "status" "personal_alert_status" NOT NULL DEFAULT 'PENDING',
    "snoozed_until" DATE,
    "read_at" TIMESTAMP(3),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_subscription_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_subscriptions_vault_id_status_idx" ON "personal_subscriptions"("vault_id", "status");

-- CreateIndex
CREATE INDEX "personal_subscriptions_vault_id_next_renewal_at_idx" ON "personal_subscriptions"("vault_id", "next_renewal_at");

-- CreateIndex
CREATE INDEX "personal_subscription_alerts_vault_id_status_reference_date_idx" ON "personal_subscription_alerts"("vault_id", "status", "reference_date");

-- CreateIndex
CREATE UNIQUE INDEX "personal_subscription_alerts_vault_id_dedupe_key_key" ON "personal_subscription_alerts"("vault_id", "dedupe_key");

-- CreateIndex
CREATE INDEX "personal_transactions_vault_id_subscription_id_idx" ON "personal_transactions"("vault_id", "subscription_id");

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "personal_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_set_subscription_id_fkey" FOREIGN KEY ("set_subscription_id") REFERENCES "personal_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscriptions" ADD CONSTRAINT "personal_subscriptions_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscriptions" ADD CONSTRAINT "personal_subscriptions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "personal_merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscriptions" ADD CONSTRAINT "personal_subscriptions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "personal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscriptions" ADD CONSTRAINT "personal_subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "personal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscriptions" ADD CONSTRAINT "personal_subscriptions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "personal_credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscription_alerts" ADD CONSTRAINT "personal_subscription_alerts_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscription_alerts" ADD CONSTRAINT "personal_subscription_alerts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "personal_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_subscription_alerts" ADD CONSTRAINT "personal_subscription_alerts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "personal_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Intervalo proprio so faz sentido em CUSTOM, e CUSTOM sem intervalo nao sabe
-- quando renova. Os dois andam juntos ou nenhum existe.
ALTER TABLE "personal_subscriptions"
  ADD CONSTRAINT "personal_subscriptions_intervalo_coerente"
  CHECK (("period" = 'CUSTOM') = ("custom_interval_days" IS NOT NULL));

-- Intervalo personalizado precisa ser um numero de dias plausivel.
ALTER TABLE "personal_subscriptions"
  ADD CONSTRAINT "personal_subscriptions_intervalo_plausivel"
  CHECK ("custom_interval_days" IS NULL
         OR ("custom_interval_days" >= 1 AND "custom_interval_days" <= 3650));

-- Valor esperado positivo: assinatura de R$0 nao gera alerta util nenhum.
ALTER TABLE "personal_subscriptions"
  ADD CONSTRAINT "personal_subscriptions_valor_positivo"
  CHECK ("expected_amount" > 0);

-- Tolerancia e percentual.
ALTER TABLE "personal_subscriptions"
  ADD CONSTRAINT "personal_subscriptions_tolerancia_valida"
  CHECK ("price_tolerance_pct" >= 0 AND "price_tolerance_pct" <= 100);

-- Antecedencia do alerta em dias, dentro de um ano.
ALTER TABLE "personal_subscriptions"
  ADD CONSTRAINT "personal_subscriptions_antecedencia_valida"
  CHECK ("alert_days_before" >= 0 AND "alert_days_before" <= 365);

ALTER TABLE "personal_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_subscription_alerts" ENABLE ROW LEVEL SECURITY;
