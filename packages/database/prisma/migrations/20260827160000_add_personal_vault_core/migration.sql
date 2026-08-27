-- Cofre Financeiro, fase 2: nucleo (contas, cartoes, categorias,
-- fornecedores, movimentacoes, divisoes e faturas).
--
-- Estritamente aditiva: 8 tabelas novas e 7 enums novos. Nenhum ALTER em
-- tabela existente, nenhum DROP, nenhum UPDATE de dado.

-- CreateEnum
CREATE TYPE "personal_account_type" AS ENUM ('CHECKING', 'SAVINGS', 'DIGITAL_WALLET', 'CASH');

-- CreateEnum
CREATE TYPE "personal_currency" AS ENUM ('BRL', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "personal_transaction_direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "personal_transaction_source" AS ENUM ('OFX', 'CSV', 'MANUAL');

-- CreateEnum
CREATE TYPE "personal_transaction_status" AS ENUM ('PENDING', 'CONFIRMED', 'IGNORED', 'REVERSED');

-- CreateEnum
CREATE TYPE "personal_split_kind" AS ENUM ('PERSONAL', 'REIMBURSABLE', 'BUSINESS');

-- CreateEnum
CREATE TYPE "personal_statement_status" AS ENUM ('OPEN', 'CLOSED', 'PARTIAL', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "personal_accounts" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "type" "personal_account_type" NOT NULL,
    "currency" "personal_currency" NOT NULL DEFAULT 'BRL',
    "last4" VARCHAR(4),
    "reported_balance" DECIMAL(14,2),
    "reported_balance_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_credit_cards" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "last4" VARCHAR(4),
    "limit_amount" DECIMAL(14,2),
    "closing_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "payment_account_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_categories" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "system_key" TEXT,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_merchants" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_category_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_merchant_aliases" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_merchant_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_statements" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "reference_month" DATE NOT NULL,
    "closing_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "personal_statement_status" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_transactions" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "account_id" TEXT,
    "card_id" TEXT,
    "transaction_date" DATE NOT NULL,
    "settlement_date" DATE,
    "originalDescription" TEXT NOT NULL,
    "normalized_description" TEXT NOT NULL,
    "merchant_id" TEXT,
    "category_id" TEXT,
    "direction" "personal_transaction_direction" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "personal_currency" NOT NULL DEFAULT 'BRL',
    "original_amount" DECIMAL(14,2),
    "original_currency" "personal_currency",
    "amount_brl" DECIMAL(14,2) NOT NULL,
    "source" "personal_transaction_source" NOT NULL,
    "external_id" TEXT,
    "fingerprint" TEXT,
    "status" "personal_transaction_status" NOT NULL DEFAULT 'CONFIRMED',
    "note" TEXT,
    "statement_id" TEXT,
    "installment_number" INTEGER,
    "installment_total" INTEGER,
    "is_transfer" BOOLEAN NOT NULL DEFAULT false,
    "transfer_pair_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_transaction_splits" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "kind" "personal_split_kind" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_transaction_splits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_accounts_vault_id_is_active_idx" ON "personal_accounts"("vault_id", "is_active");

-- CreateIndex
CREATE INDEX "personal_credit_cards_vault_id_is_active_idx" ON "personal_credit_cards"("vault_id", "is_active");

-- CreateIndex
CREATE INDEX "personal_categories_vault_id_is_active_idx" ON "personal_categories"("vault_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "personal_categories_vault_id_system_key_key" ON "personal_categories"("vault_id", "system_key");

-- CreateIndex
CREATE UNIQUE INDEX "personal_categories_vault_id_parent_id_name_key" ON "personal_categories"("vault_id", "parent_id", "name");

-- CreateIndex
CREATE INDEX "personal_merchants_vault_id_is_active_idx" ON "personal_merchants"("vault_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "personal_merchants_vault_id_name_key" ON "personal_merchants"("vault_id", "name");

-- CreateIndex
CREATE INDEX "personal_merchant_aliases_merchant_id_idx" ON "personal_merchant_aliases"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_merchant_aliases_vault_id_alias_key" ON "personal_merchant_aliases"("vault_id", "alias");

-- CreateIndex
CREATE INDEX "personal_statements_vault_id_due_date_idx" ON "personal_statements"("vault_id", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "personal_statements_card_id_reference_month_key" ON "personal_statements"("card_id", "reference_month");

-- CreateIndex
CREATE UNIQUE INDEX "personal_transactions_transfer_pair_id_key" ON "personal_transactions"("transfer_pair_id");

-- CreateIndex
CREATE INDEX "personal_transactions_vault_id_transaction_date_idx" ON "personal_transactions"("vault_id", "transaction_date");

-- CreateIndex
CREATE INDEX "personal_transactions_vault_id_settlement_date_idx" ON "personal_transactions"("vault_id", "settlement_date");

-- CreateIndex
CREATE INDEX "personal_transactions_vault_id_status_idx" ON "personal_transactions"("vault_id", "status");

-- CreateIndex
CREATE INDEX "personal_transactions_vault_id_category_id_idx" ON "personal_transactions"("vault_id", "category_id");

-- CreateIndex
CREATE INDEX "personal_transactions_vault_id_merchant_id_idx" ON "personal_transactions"("vault_id", "merchant_id");

-- CreateIndex
CREATE INDEX "personal_transactions_account_id_idx" ON "personal_transactions"("account_id");

-- CreateIndex
CREATE INDEX "personal_transactions_card_id_idx" ON "personal_transactions"("card_id");

-- CreateIndex
CREATE INDEX "personal_transactions_statement_id_idx" ON "personal_transactions"("statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_transactions_vault_id_fingerprint_key" ON "personal_transactions"("vault_id", "fingerprint");

-- CreateIndex
CREATE INDEX "personal_transaction_splits_transaction_id_idx" ON "personal_transaction_splits"("transaction_id");

-- CreateIndex
CREATE INDEX "personal_transaction_splits_vault_id_kind_idx" ON "personal_transaction_splits"("vault_id", "kind");

-- AddForeignKey
ALTER TABLE "personal_accounts" ADD CONSTRAINT "personal_accounts_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_credit_cards" ADD CONSTRAINT "personal_credit_cards_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_credit_cards" ADD CONSTRAINT "personal_credit_cards_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "personal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_categories" ADD CONSTRAINT "personal_categories_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_categories" ADD CONSTRAINT "personal_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "personal_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_merchants" ADD CONSTRAINT "personal_merchants_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_merchants" ADD CONSTRAINT "personal_merchants_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "personal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_merchant_aliases" ADD CONSTRAINT "personal_merchant_aliases_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_merchant_aliases" ADD CONSTRAINT "personal_merchant_aliases_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "personal_merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_statements" ADD CONSTRAINT "personal_statements_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_statements" ADD CONSTRAINT "personal_statements_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "personal_credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "personal_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "personal_credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "personal_merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "personal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "personal_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transaction_splits" ADD CONSTRAINT "personal_transaction_splits_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transaction_splits" ADD CONSTRAINT "personal_transaction_splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "personal_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_transaction_splits" ADD CONSTRAINT "personal_transaction_splits_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "personal_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Invariantes que o Prisma nao sabe expressar, mas que o banco precisa
-- garantir. Sao regras de dinheiro: deixa-las so na camada de aplicacao
-- significa que um bug futuro (ou um script de importacao) grava numero
-- errado em silencio, e o erro so aparece num total que nao fecha.
-- ---------------------------------------------------------------------------

-- Uma movimentacao tem origem em UMA conta OU UM cartao. Os dois nulos = linha
-- sem origem; os dois preenchidos = a mesma despesa contada duas vezes.
ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_origem_unica"
  CHECK (("account_id" IS NULL) <> ("card_id" IS NULL));

-- Valor sempre positivo: quem diz entrada/saida e a coluna `direction`.
ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_valor_positivo"
  CHECK ("amount" > 0 AND "amount_brl" > 0);

-- Parcela coerente: ou nenhuma das duas colunas, ou as duas com 1 <= atual <= total.
ALTER TABLE "personal_transactions"
  ADD CONSTRAINT "personal_transactions_parcela_coerente"
  CHECK (
    ("installment_number" IS NULL AND "installment_total" IS NULL)
    OR ("installment_number" >= 1 AND "installment_total" >= 1
        AND "installment_number" <= "installment_total")
  );

-- Divisao de valor zero ou negativo nao divide nada.
ALTER TABLE "personal_transaction_splits"
  ADD CONSTRAINT "personal_transaction_splits_valor_positivo"
  CHECK ("amount" > 0);

-- Dias de fechamento e vencimento existem no calendario.
ALTER TABLE "personal_credit_cards"
  ADD CONSTRAINT "personal_credit_cards_dias_validos"
  CHECK ("closing_day" BETWEEN 1 AND 31 AND "due_day" BETWEEN 1 AND 31);

-- Fatura nao pode ter pagamento negativo.
ALTER TABLE "personal_statements"
  ADD CONSTRAINT "personal_statements_valores_nao_negativos"
  CHECK ("total_amount" >= 0 AND "paid_amount" >= 0);

-- ---------------------------------------------------------------------------
-- RLS: o Supabase expoe o schema public via PostgREST. Sem isto, as tabelas do
-- Cofre ficariam legiveis com a anon key. `ensure-rls.sql` tambem cobriria,
-- mas nestas tabelas em especial nao da pra depender da rede de seguranca.
-- ---------------------------------------------------------------------------
ALTER TABLE "personal_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_credit_cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_merchant_aliases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_transaction_splits" ENABLE ROW LEVEL SECURITY;
