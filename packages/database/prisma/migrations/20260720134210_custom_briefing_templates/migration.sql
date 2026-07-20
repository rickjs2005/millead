-- AlterEnum
ALTER TYPE "briefing_template_kind" ADD VALUE 'CUSTOM';

-- AlterTable
ALTER TABLE "briefing_templates" ADD COLUMN     "organization_id" TEXT;

-- CreateIndex
CREATE INDEX "briefing_templates_organization_id_idx" ON "briefing_templates"("organization_id");

-- AddForeignKey
ALTER TABLE "briefing_templates" ADD CONSTRAINT "briefing_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
