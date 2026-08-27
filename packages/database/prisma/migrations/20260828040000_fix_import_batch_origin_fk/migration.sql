-- Correcao encontrada validando a interface: apagar uma conta respondia 500.
--
-- `personal_import_batches` tem o CHECK de origem unica (conta XOR cartao),
-- mas as FKs eram `ON DELETE SET NULL`. Ao apagar a conta, o Postgres zerava
-- `account_id` e as duas colunas ficavam nulas -- violando a propria
-- constraint. O erro subia como 500 em vez do 409 previsto.
--
-- Cascade tambem e o significado certo: um lote descreve uma importacao PARA
-- uma origem, e sem ela nao descreve nada. Quando a origem pode ser apagada,
-- as movimentacoes dela ja foram embora (a FK delas e Restrict).
--
-- Nao toca em dado: so troca a acao de exclusao de duas FKs.

ALTER TABLE "personal_import_batches" DROP CONSTRAINT "personal_import_batches_account_id_fkey";
ALTER TABLE "personal_import_batches" DROP CONSTRAINT "personal_import_batches_card_id_fkey";

ALTER TABLE "personal_import_batches" ADD CONSTRAINT "personal_import_batches_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "personal_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "personal_import_batches" ADD CONSTRAINT "personal_import_batches_card_id_fkey"
  FOREIGN KEY ("card_id") REFERENCES "personal_credit_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
