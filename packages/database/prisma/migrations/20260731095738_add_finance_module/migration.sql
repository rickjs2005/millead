-- CreateEnum
CREATE TYPE "CostScope" AS ENUM ('AGENCY', 'CLIENT');

-- CreateEnum
CREATE TYPE "CostCurrency" AS ENUM ('BRL', 'USD');

-- CreateEnum
CREATE TYPE "CostBillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('HOSTING', 'DATABASE', 'AI', 'DOMAIN', 'EMAIL', 'SIGNATURE', 'OTHER');

-- CreateTable
CREATE TABLE "cost_subscriptions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT,
    "service_key" TEXT,
    "name" TEXT NOT NULL,
    "scope" "CostScope" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "CostCurrency" NOT NULL DEFAULT 'BRL',
    "billing_cycle" "CostBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "capacity_limit" INTEGER,
    "capacity_used" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_service_catalog" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "default_amount" DECIMAL(12,2) NOT NULL,
    "currency" "CostCurrency" NOT NULL DEFAULT 'USD',
    "billing_cycle" "CostBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "default_scope" "CostScope" NOT NULL DEFAULT 'CLIENT',
    "default_capacity_limit" INTEGER,
    "best_for" TEXT,
    "billing_notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_service_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "usd_to_brl_rate" DECIMAL(8,4) NOT NULL DEFAULT 5.30,
    "default_hourly_rate" DECIMAL(12,2) NOT NULL DEFAULT 120,
    "support_reserve_pct" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "default_margin_pct" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "active_clients_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "price_min" DECIMAL(12,2) NOT NULL,
    "price_max" DECIMAL(12,2) NOT NULL,
    "base_hours" INTEGER,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_subscriptions_organization_id_scope_idx" ON "cost_subscriptions"("organization_id", "scope");

-- CreateIndex
CREATE INDEX "cost_subscriptions_organization_id_is_active_idx" ON "cost_subscriptions"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "cost_service_catalog_key_key" ON "cost_service_catalog"("key");

-- CreateIndex
CREATE INDEX "cost_service_catalog_organization_id_idx" ON "cost_service_catalog"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "finance_settings_organization_id_key" ON "finance_settings"("organization_id");

-- CreateIndex
CREATE INDEX "project_products_organization_id_idx" ON "project_products"("organization_id");

-- AddForeignKey
ALTER TABLE "cost_subscriptions" ADD CONSTRAINT "cost_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_subscriptions" ADD CONSTRAINT "cost_subscriptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_service_catalog" ADD CONSTRAINT "cost_service_catalog_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_settings" ADD CONSTRAINT "finance_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_products" ADD CONSTRAINT "project_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase expõe o schema public via PostgREST; sem RLS a tabela fica legível
-- com a anon key (ver README). Nenhuma policy = nega tudo; a API usa a
-- connection string direta (bypassa RLS).
ALTER TABLE "cost_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_service_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_products" ENABLE ROW LEVEL SECURITY;
