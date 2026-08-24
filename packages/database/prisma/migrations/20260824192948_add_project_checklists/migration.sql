-- CreateEnum
CREATE TYPE "project_checklist_type" AS ENUM ('INSTITUTIONAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "project_checklist_phase_status" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_APPLICABLE');

-- CreateTable
CREATE TABLE "project_checklists" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "project_checklist_type" NOT NULL,
    "company_id" TEXT,
    "local_folder" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_checklist_phases" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "project_checklist_id" TEXT NOT NULL,
    "phase_number" INTEGER NOT NULL,
    "phase_name" TEXT NOT NULL,
    "status" "project_checklist_phase_status" NOT NULL DEFAULT 'NOT_STARTED',
    "na_note" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_checklist_phases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_checklists_organization_id_idx" ON "project_checklists"("organization_id");

-- CreateIndex
CREATE INDEX "project_checklist_phases_organization_id_idx" ON "project_checklist_phases"("organization_id");

-- CreateIndex
CREATE INDEX "project_checklist_phases_project_checklist_id_idx" ON "project_checklist_phases"("project_checklist_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_checklist_phases_project_checklist_id_phase_number_key" ON "project_checklist_phases"("project_checklist_id", "phase_number");

-- AddForeignKey
ALTER TABLE "project_checklists" ADD CONSTRAINT "project_checklists_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklists" ADD CONSTRAINT "project_checklists_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklist_phases" ADD CONSTRAINT "project_checklist_phases_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_checklist_phases" ADD CONSTRAINT "project_checklist_phases_project_checklist_id_fkey" FOREIGN KEY ("project_checklist_id") REFERENCES "project_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS explícita: ensure-rls.sql roda de novo em todo migrate:deploy (idempotente),
-- mas só nesse momento -- não no "prisma migrate dev" local. Habilitar aqui
-- também deixa o dev local protegido desde já (mesma convenção desde a
-- migration 20260818140000_enable_rls_all_public_tables).
ALTER TABLE "project_checklists" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_checklist_phases" ENABLE ROW LEVEL SECURITY;
