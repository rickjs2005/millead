-- AlterTable
ALTER TABLE "pricing_estimates" ADD COLUMN     "domain_year_price_brl" DECIMAL(12,2),
ADD COLUMN     "domain_years" INTEGER,
ADD COLUMN     "final_price" DECIMAL(12,2);
