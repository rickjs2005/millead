-- Alinha os enums do módulo Financeiro ao padrão snake_case do resto do
-- schema (23 enums pré-existentes usam @@map; estes 4 tinham ficado de fora
-- na migration anterior). RENAME preserva o tipo e os valores -- as colunas
-- que já referenciam esses enums continuam funcionando sem qualquer
-- DROP/CREATE de coluna (as tabelas são novas e vazias, mas RENAME é a
-- operação correta de qualquer forma: não há motivo pra recriar dado).
ALTER TYPE "CostScope" RENAME TO "cost_scope";
ALTER TYPE "CostCurrency" RENAME TO "cost_currency";
ALTER TYPE "CostBillingCycle" RENAME TO "cost_billing_cycle";
ALTER TYPE "CostCategory" RENAME TO "cost_category";
