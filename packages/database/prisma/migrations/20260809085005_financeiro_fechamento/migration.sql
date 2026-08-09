-- AlterEnum
ALTER TYPE "receivable_kind" ADD VALUE 'AVULSA';

-- AlterTable
ALTER TABLE "finance_settings" ADD COLUMN     "usd_rate_auto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "usd_rate_updated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "receivables" ADD COLUMN     "description" TEXT,
ALTER COLUMN "contract_id" DROP NOT NULL;
