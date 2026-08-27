-- Cofre Financeiro, fase 3: importacao (lote e perfil de mapeamento).
--
-- Aditiva: 2 tabelas novas, 2 enums novos e UMA coluna anulavel em
-- personal_transactions (import_batch_id). Nenhum DROP, nenhum UPDATE de
-- dado, nenhuma coluna existente alterada.

-- CreateEnum
CREATE TYPE "personal_import_format" AS ENUM ('OFX', 'CSV');

-- CreateEnum
CREATE TYPE "personal_import_status" AS ENUM ('COMPLETED', 'PARTIAL', 'FAILED');

-- AlterTable
ALTER TABLE "personal_transactions" ADD COLUMN     "import_batch_id" TEXT;

-- CreateTable
CREATE TABLE "personal_import_batches" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "account_id" TEXT,
    "card_id" TEXT,
    "format" "personal_import_format" NOT NULL,
    "file_hash" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "imported_rows" INTEGER NOT NULL DEFAULT 0,
    "duplicate_rows" INTEGER NOT NULL DEFAULT 0,
    "ignored_rows" INTEGER NOT NULL DEFAULT 0,
    "status" "personal_import_status" NOT NULL,
    "errors" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personal_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_import_profiles" (
    "id" TEXT NOT NULL,
    "vault_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_id" TEXT,
    "card_id" TEXT,
    "format" "personal_import_format" NOT NULL DEFAULT 'CSV',
    "delimiter" TEXT NOT NULL DEFAULT ',',
    "decimal_separator" TEXT NOT NULL DEFAULT ',',
    "date_order" TEXT NOT NULL DEFAULT 'DMY',
    "has_header" BOOLEAN NOT NULL DEFAULT true,
    "column_map" JSONB NOT NULL,
    "invert_sign" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_import_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personal_import_batches_vault_id_created_at_idx" ON "personal_import_batches"("vault_id", "created_at");

-- CreateIndex
CREATE INDEX "personal_import_batches_vault_id_file_hash_idx" ON "personal_import_batches"("vault_id", "file_hash");

-- CreateIndex
CREATE INDEX "personal_import_profiles_vault_id_idx" ON "personal_import_profiles"("vault_id");

-- CreateIndex
CREATE UNIQUE INDEX "personal_import_profiles_vault_id_name_key" ON "personal_import_profiles"("vault_id", "name");

-- CreateIndex
CREATE INDEX "personal_transactions_import_batch_id_idx" ON "personal_transactions"("import_batch_id");

-- AddForeignKey
ALTER TABLE "personal_transactions" ADD CONSTRAINT "personal_transactions_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "personal_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_import_batches" ADD CONSTRAINT "personal_import_batches_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_import_batches" ADD CONSTRAINT "personal_import_batches_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "personal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_import_batches" ADD CONSTRAINT "personal_import_batches_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "personal_credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_import_profiles" ADD CONSTRAINT "personal_import_profiles_vault_id_fkey" FOREIGN KEY ("vault_id") REFERENCES "personal_vaults"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_import_profiles" ADD CONSTRAINT "personal_import_profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "personal_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_import_profiles" ADD CONSTRAINT "personal_import_profiles_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "personal_credit_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Mesma invariante da movimentacao: um lote e de UMA conta ou de UM cartao.
-- Os dois nulos = lote sem origem; os dois preenchidos = contagem duplicada.
ALTER TABLE "personal_import_batches"
  ADD CONSTRAINT "personal_import_batches_origem_unica"
  CHECK (("account_id" IS NULL) <> ("card_id" IS NULL));

-- Contagens sao contagens: nunca negativas.
ALTER TABLE "personal_import_batches"
  ADD CONSTRAINT "personal_import_batches_contagens_nao_negativas"
  CHECK ("total_rows" >= 0 AND "imported_rows" >= 0
         AND "duplicate_rows" >= 0 AND "ignored_rows" >= 0);

-- RLS (ver README sobre o PostgREST do Supabase).
ALTER TABLE "personal_import_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "personal_import_profiles" ENABLE ROW LEVEL SECURITY;
