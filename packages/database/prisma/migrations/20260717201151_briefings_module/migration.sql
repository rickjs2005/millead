-- CreateEnum
CREATE TYPE "briefing_template_kind" AS ENUM ('INSTITUCIONAL', 'ECOMMERCE');

-- CreateEnum
CREATE TYPE "briefing_field_type" AS ENUM ('TEXT', 'TEXTAREA', 'EMAIL', 'PHONE', 'URL', 'SELECT', 'MULTI_SELECT', 'FILE', 'GROUP');

-- CreateEnum
CREATE TYPE "briefing_status" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "activity_type" ADD VALUE 'BRIEFING_SENT';
ALTER TYPE "activity_type" ADD VALUE 'BRIEFING_COMPLETED';

-- CreateTable
CREATE TABLE "briefing_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "briefing_template_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_sections" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_fields" (
    "id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "parent_field_id" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "briefing_field_type" NOT NULL,
    "order" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "help_text" TEXT,
    "config" JSONB,

    CONSTRAINT "briefing_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "company_id" TEXT,
    "created_by_id" TEXT,
    "status" "briefing_status" NOT NULL DEFAULT 'PENDING',
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "pdf_url" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_links" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "briefing_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_answers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "briefing_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "group_item_id" TEXT NOT NULL DEFAULT '',
    "group_item_order" INTEGER,
    "value_text" TEXT,
    "value_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "briefing_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_files" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "briefing_id" TEXT NOT NULL,
    "blob_url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefing_history" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "briefing_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefing_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "briefing_templates_key_key" ON "briefing_templates"("key");

-- CreateIndex
CREATE INDEX "briefing_sections_template_id_idx" ON "briefing_sections"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_sections_template_id_key_key" ON "briefing_sections"("template_id", "key");

-- CreateIndex
CREATE INDEX "briefing_fields_section_id_idx" ON "briefing_fields"("section_id");

-- CreateIndex
CREATE INDEX "briefing_fields_parent_field_id_idx" ON "briefing_fields"("parent_field_id");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_fields_section_id_key_key" ON "briefing_fields"("section_id", "key");

-- CreateIndex
CREATE INDEX "briefings_organization_id_status_idx" ON "briefings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "briefings_lead_id_idx" ON "briefings"("lead_id");

-- CreateIndex
CREATE INDEX "briefings_company_id_idx" ON "briefings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_links_briefing_id_key" ON "briefing_links"("briefing_id");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_links_token_key" ON "briefing_links"("token");

-- CreateIndex
CREATE INDEX "briefing_answers_organization_id_idx" ON "briefing_answers"("organization_id");

-- CreateIndex
CREATE INDEX "briefing_answers_briefing_id_idx" ON "briefing_answers"("briefing_id");

-- CreateIndex
CREATE UNIQUE INDEX "briefing_answers_briefing_id_field_id_group_item_id_key" ON "briefing_answers"("briefing_id", "field_id", "group_item_id");

-- CreateIndex
CREATE INDEX "briefing_files_organization_id_idx" ON "briefing_files"("organization_id");

-- CreateIndex
CREATE INDEX "briefing_files_briefing_id_idx" ON "briefing_files"("briefing_id");

-- CreateIndex
CREATE INDEX "briefing_history_briefing_id_created_at_idx" ON "briefing_history"("briefing_id", "created_at");

-- AddForeignKey
ALTER TABLE "briefing_sections" ADD CONSTRAINT "briefing_sections_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "briefing_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_fields" ADD CONSTRAINT "briefing_fields_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "briefing_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_fields" ADD CONSTRAINT "briefing_fields_parent_field_id_fkey" FOREIGN KEY ("parent_field_id") REFERENCES "briefing_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "briefing_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_links" ADD CONSTRAINT "briefing_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_links" ADD CONSTRAINT "briefing_links_briefing_id_fkey" FOREIGN KEY ("briefing_id") REFERENCES "briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_answers" ADD CONSTRAINT "briefing_answers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_answers" ADD CONSTRAINT "briefing_answers_briefing_id_fkey" FOREIGN KEY ("briefing_id") REFERENCES "briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_answers" ADD CONSTRAINT "briefing_answers_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "briefing_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_files" ADD CONSTRAINT "briefing_files_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_files" ADD CONSTRAINT "briefing_files_briefing_id_fkey" FOREIGN KEY ("briefing_id") REFERENCES "briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_history" ADD CONSTRAINT "briefing_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefing_history" ADD CONSTRAINT "briefing_history_briefing_id_fkey" FOREIGN KEY ("briefing_id") REFERENCES "briefings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
