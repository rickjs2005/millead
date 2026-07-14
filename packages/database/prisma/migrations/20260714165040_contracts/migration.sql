-- CreateEnum
CREATE TYPE "contract_type" AS ENUM ('SITE', 'SISTEMA', 'SAAS', 'MANUTENCAO', 'CONSULTORIA');

-- CreateEnum
CREATE TYPE "contract_payment_method" AS ENUM ('PIX', 'BOLETO', 'CARTAO', 'TRANSFERENCIA', 'PARCELADO');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('RASCUNHO', 'VALIDADO', 'PDF_GERADO', 'AGUARDANDO_ASSINATURA', 'ASSINADO', 'CANCELADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "contract_signature_provider" AS ENUM ('MOCK', 'ZAPSIGN', 'CLICKSIGN', 'DOCUSIGN', 'AUTENTIQUE');

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "created_by_id" TEXT,
    "numero" TEXT NOT NULL,
    "tipo" "contract_type" NOT NULL DEFAULT 'SITE',
    "status" "contract_status" NOT NULL DEFAULT 'RASCUNHO',
    "descricao_projeto" TEXT NOT NULL,
    "valor_total" DECIMAL(12,2) NOT NULL,
    "forma_pagamento" "contract_payment_method" NOT NULL,
    "percentual_entrada" DECIMAL(5,2) NOT NULL,
    "prazo_entrega_dias" INTEGER NOT NULL,
    "limite_revisoes" INTEGER NOT NULL DEFAULT 2,
    "contractor_snapshot" JSONB NOT NULL,
    "contracted_snapshot" JSONB NOT NULL,
    "provider" "contract_signature_provider" NOT NULL DEFAULT 'MOCK',
    "signature_doc_id" TEXT,
    "signature_url" TEXT,
    "assinado_em" TIMESTAMP(3),
    "pdf_original" BYTEA,
    "pdf_assinado" BYTEA,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_signers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "papel" TEXT NOT NULL,
    "assinado_em" TIMESTAMP(3),
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_signers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_events" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origem" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_sequences" (
    "organization_id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "contract_sequences_pkey" PRIMARY KEY ("organization_id","ano")
);

-- CreateIndex
CREATE INDEX "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "contracts_company_id_idx" ON "contracts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organization_id_numero_key" ON "contracts"("organization_id", "numero");

-- CreateIndex
CREATE INDEX "contract_signers_contract_id_idx" ON "contract_signers"("contract_id");

-- CreateIndex
CREATE INDEX "contract_events_contract_id_created_at_idx" ON "contract_events"("contract_id", "created_at");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signers" ADD CONSTRAINT "contract_signers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signers" ADD CONSTRAINT "contract_signers_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_events" ADD CONSTRAINT "contract_events_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_sequences" ADD CONSTRAINT "contract_sequences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
