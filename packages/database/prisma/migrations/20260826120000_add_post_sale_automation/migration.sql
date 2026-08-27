-- CreateEnum
CREATE TYPE "automation_event_type" AS ENUM ('CONTRACT_SIGNED');

-- CreateEnum
CREATE TYPE "automation_trigger" AS ENUM ('WEBHOOK', 'MANUAL');

-- CreateEnum
CREATE TYPE "automation_execution_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "automation_step_key" AS ENUM ('LEAD_WON', 'RECEIVABLES', 'BRIEFING', 'PROJECT', 'TASKS');

-- CreateEnum
CREATE TYPE "automation_step_status" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'SKIPPED', 'NEEDS_ACTION', 'FAILED');

-- CreateEnum
CREATE TYPE "automation_artifact_type" AS ENUM ('LEAD', 'RECEIVABLE_PLAN', 'BRIEFING', 'PROJECT_CHECKLIST', 'TASK');

-- AlterTable
ALTER TABLE "briefings" ADD COLUMN     "contract_id" TEXT;

-- AlterTable
ALTER TABLE "project_checklists" ADD COLUMN     "contract_id" TEXT,
ADD COLUMN     "due_at" TIMESTAMP(3),
ADD COLUMN     "lead_id" TEXT,
ADD COLUMN     "started_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "post_sale_automation_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "won_stage_id" TEXT,
    "briefing_template_key" TEXT,
    "project_type" "project_checklist_type",
    "default_owner_id" TEXT,
    "create_receivables" BOOLEAN NOT NULL DEFAULT true,
    "installment_count" INTEGER,
    "entry_due_days" INTEGER,
    "first_installment_due_days" INTEGER,
    "create_briefing" BOOLEAN NOT NULL DEFAULT true,
    "create_project" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_sale_automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "event_type" "automation_event_type" NOT NULL,
    "contract_id" TEXT NOT NULL,
    "status" "automation_execution_status" NOT NULL DEFAULT 'PENDING',
    "triggered_by" "automation_trigger" NOT NULL DEFAULT 'WEBHOOK',
    "triggered_by_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "error" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_steps" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "key" "automation_step_key" NOT NULL,
    "status" "automation_step_status" NOT NULL DEFAULT 'PENDING',
    "detail" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_artifacts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "step_key" "automation_step_key" NOT NULL,
    "key" TEXT NOT NULL,
    "type" "automation_artifact_type" NOT NULL,
    "ref_id" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "post_sale_automation_settings_organization_id_key" ON "post_sale_automation_settings"("organization_id");

-- CreateIndex
CREATE INDEX "automation_executions_organization_id_status_idx" ON "automation_executions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "automation_executions_contract_id_idx" ON "automation_executions"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_executions_organization_id_event_type_contract_i_key" ON "automation_executions"("organization_id", "event_type", "contract_id");

-- CreateIndex
CREATE INDEX "automation_steps_organization_id_idx" ON "automation_steps"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_steps_execution_id_key_key" ON "automation_steps"("execution_id", "key");

-- CreateIndex
CREATE INDEX "automation_artifacts_organization_id_idx" ON "automation_artifacts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_artifacts_execution_id_key_key" ON "automation_artifacts"("execution_id", "key");

-- CreateIndex
CREATE INDEX "briefings_contract_id_idx" ON "briefings"("contract_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_checklists_contract_id_key" ON "project_checklists"("contract_id");

-- CreateIndex
CREATE INDEX "project_checklists_lead_id_idx" ON "project_checklists"("lead_id");

-- AddForeignKey
ALTER TABLE "project_checklists" ADD CONSTRAINT "project_checklists_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklists" ADD CONSTRAINT "project_checklists_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_automation_settings" ADD CONSTRAINT "post_sale_automation_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_automation_settings" ADD CONSTRAINT "post_sale_automation_settings_won_stage_id_fkey" FOREIGN KEY ("won_stage_id") REFERENCES "pipeline_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_sale_automation_settings" ADD CONSTRAINT "post_sale_automation_settings_default_owner_id_fkey" FOREIGN KEY ("default_owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_steps" ADD CONSTRAINT "automation_steps_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "automation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_artifacts" ADD CONSTRAINT "automation_artifacts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_artifacts" ADD CONSTRAINT "automation_artifacts_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "automation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RLS explícita: ensure-rls.sql roda de novo em todo migrate:deploy (idempotente),
-- mas só nesse momento -- não no "prisma migrate dev" local. Habilitar aqui
-- também deixa o dev local protegido desde já (mesma convenção desde a
-- migration 20260818140000_enable_rls_all_public_tables).
ALTER TABLE "post_sale_automation_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_steps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "automation_artifacts" ENABLE ROW LEVEL SECURITY;
