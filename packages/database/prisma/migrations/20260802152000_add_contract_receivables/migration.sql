-- CreateEnum
CREATE TYPE "receivable_kind" AS ENUM ('ENTRADA', 'PARCELA');

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "kind" "receivable_kind" NOT NULL,
    "installment_index" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "paid_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receivables_contract_id_installment_index_key" ON "receivables"("contract_id", "installment_index");

-- CreateIndex
CREATE INDEX "receivables_organization_id_due_date_idx" ON "receivables"("organization_id", "due_date");

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
