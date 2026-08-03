-- Snapshot do preço/crédito em BRL no momento do lançamento de uso.
-- Sem isso, o custo de meses já fechados era recalculado ao vivo a partir
-- do estado ATUAL da assinatura/câmbio, reescrevendo retroativamente
-- valores já reportados/cobrados quando o preço da assinatura ou o câmbio
-- da org mudava depois.
ALTER TABLE "cost_usage_entries" ADD COLUMN "unit_price_brl" DECIMAL(14,6);
