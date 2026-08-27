-- Cofre Financeiro, fase 4: regras de classificacao deterministicas.
--
-- Aditiva: 1 tabela nova e 1 enum novo. Nenhuma tabela existente e tocada.

-- CreateEnum
CREATE TYPE "personal_rule_match_type" AS ENUM ('CONTAINS', 'STARTS_WITH', 'EXACT');

-- CreateTable
CREATE TABLE "personal_classification_rules" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "match_type" "personal_rule_match_type",
    "match_value" TEXT,
    "match_merchant_id" TEXT,
    "match_account_id" TEXT,
    "match_card_id" TEXT,
    "match_amount_min" DECIMAL(14,2),
    "match_amount_max" DECIMAL(14,2),
    "set_merchant_id" TEXT,
    "set_category_id" TEXT,
    "business_percent" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_classification_rules_vault_id_is_active_priority_idx" ON "personal_classification_rules"("vault_id", "is_active", "priority");

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_match_merchant_id_fkey" FOREIGN KEY ("match_merchant_id") REFERENCES "personal_merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_match_account_id_fkey" FOREIGN KEY ("match_account_id") REFERENCES "personal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_match_card_id_fkey" FOREIGN KEY ("match_card_id") REFERENCES "personal_credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_set_merchant_id_fkey" FOREIGN KEY ("set_merchant_id") REFERENCES "personal_merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_classification_rules" ADD CONSTRAINT "personal_classification_rules_set_category_id_fkey" FOREIGN KEY ("set_category_id") REFERENCES "personal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Percentual empresarial e percentual: fora de 0..100 nao significa nada, e um
-- valor absurdo aqui viraria despesa empresarial absurda na fase 7.
ALTER TABLE "personal_classification_rules"
  ADD CONSTRAINT "personal_classification_rules_percentual_valido"
  CHECK ("business_percent" IS NULL OR ("business_percent" >= 0 AND "business_percent" <= 100));

-- Faixa de valor coerente: minimo maior que maximo nunca casaria com nada, e
-- uma regra que nunca casa e uma regra que voce acha que esta funcionando.
ALTER TABLE "personal_classification_rules"
  ADD CONSTRAINT "personal_classification_rules_faixa_coerente"
  CHECK ("match_amount_min" IS NULL OR "match_amount_max" IS NULL
         OR "match_amount_min" <= "match_amount_max");

-- matchType e matchValue andam juntos: um sem o outro e condicao pela metade.
ALTER TABLE "personal_classification_rules"
  ADD CONSTRAINT "personal_classification_rules_match_completo"
  CHECK (("match_type" IS NULL) = ("match_value" IS NULL));

ALTER TABLE "personal_classification_rules" ENABLE ROW LEVEL SECURITY;
