-- AlterTable
ALTER TABLE "cost_subscriptions" ADD COLUMN     "credits_included" INTEGER;

-- AlterTable
ALTER TABLE "pricing_estimate_costs" ADD COLUMN     "is_one_time" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "cost_usage_entries" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "company_id" TEXT,
    "credits" INTEGER NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_usage_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_usage_entries_organization_id_used_at_idx" ON "cost_usage_entries"("organization_id", "used_at");

-- CreateIndex
CREATE INDEX "cost_usage_entries_organization_id_subscription_id_idx" ON "cost_usage_entries"("organization_id", "subscription_id");

-- AddForeignKey
ALTER TABLE "cost_usage_entries" ADD CONSTRAINT "cost_usage_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_usage_entries" ADD CONSTRAINT "cost_usage_entries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "cost_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_usage_entries" ADD CONSTRAINT "cost_usage_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase expõe o schema public via PostgREST; sem RLS a tabela fica legível
-- com a anon key (ver README). Nenhuma policy = nega tudo; a API usa a
-- connection string direta (bypassa RLS).
ALTER TABLE "cost_usage_entries" ENABLE ROW LEVEL SECURITY;
