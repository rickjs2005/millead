-- AlterTable
ALTER TABLE "proposals" ADD COLUMN "public_token" TEXT,
ADD COLUMN "viewed_at" TIMESTAMP(3),
ADD COLUMN "decided_at" TIMESTAMP(3),
ADD COLUMN "decision_ip" TEXT,
ADD COLUMN "reject_reason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "proposals_public_token_key" ON "proposals"("public_token");

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "proposal_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "contracts_proposal_id_key" ON "contracts"("proposal_id");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
