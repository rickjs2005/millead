-- Cofre Financeiro, fase 1: apenas a raiz do módulo (PersonalVault).
-- Estritamente aditiva: cria uma tabela nova e nada mais. Nenhum ALTER em
-- tabela existente, nenhum DROP, nenhum UPDATE de dado.
--
-- Sem `organization_id` de propósito -- o dono é o usuário. Ver o comentário
-- do modelo em schema.prisma e docs/personal-finance-vault.md.

-- CreateTable
CREATE TABLE "personal_vaults" (
    "id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_unlocked_at" TIMESTAMP(3),
    "sessions_invalidated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_vaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "personal_vaults_owner_user_id_key" ON "personal_vaults"("owner_user_id");

-- AddForeignKey
ALTER TABLE "personal_vaults" ADD CONSTRAINT "personal_vaults_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS: o Supabase expõe o schema public via PostgREST. Sem isto, a tabela do
-- Cofre ficaria legível com a anon key. `ensure-rls.sql` também cobriria, mas
-- a linha explícita aqui é a primeira barreira -- e nesta tabela em especial
-- não dá pra depender da rede de segurança.
ALTER TABLE "personal_vaults" ENABLE ROW LEVEL SECURITY;
