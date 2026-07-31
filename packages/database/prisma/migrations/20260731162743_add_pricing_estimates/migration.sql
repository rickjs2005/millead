-- CreateEnum
CREATE TYPE "estimate_status" AS ENUM ('DRAFT', 'READY', 'CONVERTED');

-- CreateTable
CREATE TABLE "pricing_estimates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "product_id" TEXT,
    "proposal_id" TEXT,
    "title" TEXT NOT NULL,
    "status" "estimate_status" NOT NULL DEFAULT 'DRAFT',
    "hourly_rate" DECIMAL(12,2) NOT NULL,
    "hours_breakdown" JSONB NOT NULL DEFAULT '[]',
    "agency_share_monthly" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "infra_months" INTEGER NOT NULL DEFAULT 12,
    "support_reserve_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "margin_pct" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "scope_items" JSONB NOT NULL DEFAULT '[]',
    "deadline_days" INTEGER NOT NULL DEFAULT 30,
    "payment_terms" TEXT NOT NULL DEFAULT '50% para iniciar, 50% na entrega',
    "valid_days" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_estimate_costs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "cost_currency" NOT NULL DEFAULT 'BRL',
    "billing_cycle" "cost_billing_cycle" NOT NULL DEFAULT 'MONTHLY',

    CONSTRAINT "pricing_estimate_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_estimates_proposal_id_key" ON "pricing_estimates"("proposal_id");

-- CreateIndex
CREATE INDEX "pricing_estimates_organization_id_status_idx" ON "pricing_estimates"("organization_id", "status");

-- CreateIndex
CREATE INDEX "pricing_estimates_organization_id_lead_id_idx" ON "pricing_estimates"("organization_id", "lead_id");

-- CreateIndex
CREATE INDEX "pricing_estimate_costs_organization_id_estimate_id_idx" ON "pricing_estimate_costs"("organization_id", "estimate_id");

-- AddForeignKey
ALTER TABLE "pricing_estimates" ADD CONSTRAINT "pricing_estimates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimates" ADD CONSTRAINT "pricing_estimates_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimates" ADD CONSTRAINT "pricing_estimates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimates" ADD CONSTRAINT "pricing_estimates_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "project_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimates" ADD CONSTRAINT "pricing_estimates_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimate_costs" ADD CONSTRAINT "pricing_estimate_costs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimate_costs" ADD CONSTRAINT "pricing_estimate_costs_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "pricing_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_estimate_costs" ADD CONSTRAINT "pricing_estimate_costs_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "cost_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase expõe o schema public via PostgREST; sem RLS a tabela fica legível
-- com a anon key (ver README). Nenhuma policy = nega tudo; a API usa a
-- connection string direta (bypassa RLS).
ALTER TABLE "pricing_estimates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pricing_estimate_costs" ENABLE ROW LEVEL SECURITY;
