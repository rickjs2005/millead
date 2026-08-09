# Fechamento do financeiro: cotação automática, receita avulsa, recorrentes na série — design

Data: 2026-08-09 · Aprovado pelo Rick ("fecha o lado financeiro"; dor: meses vazios com dinheiro real; pergunta da cotação)

## Dor diagnosticada

1. `Receivable.contractId` é obrigatório → receita sem contrato (ex.: R$ 1.500 do Rick) não é registrável; "Recebido" zera.
2. Custo recorrente (CostSubscription) não entra na série mensal — só lançamentos de consumo; "gastei com assinatura" não aparece nos meses.
3. `FinanceSettings.usdToBrlRate` é manual (default 5.30) — sem atualização automática.

## A) Cotação USD→BRL automática

- Migração aditiva em `FinanceSettings`: `usdRateAuto Boolean @default(true)`, `usdRateUpdatedAt DateTime?`.
- Estratégia **lazy no read** (Render free dorme; cron externo desnecessário): quando qualquer fluxo lê settings (`getSettings` do cost-service/finance), se `usdRateAuto && (usdRateUpdatedAt null || > 24h)`, buscar `https://economia.awesomeapi.com.br/json/last/USD-BRL` (campo `USDBRL.bid`), atualizar rate+timestamp. **Falha da API externa NUNCA quebra o fluxo** — loga e usa o valor persistido (fallback). Timeout curto (3s). Validação sanidade: bid numérico entre 1 e 20, senão descarta.
- PATCH de settings com `usdToBrlRate` manual seta `usdRateAuto=false` automaticamente (editar na mão = quer manual); PATCH pode religar `usdRateAuto=true`.
- Resposta de settings expõe os 2 campos novos; UI de Configurações do Centro de Custos mostra "Cotação: R$ X,XX · atualizada automaticamente em DD/MM HH:mm" + toggle auto/manual.

## B) Receita avulsa (sem contrato)

- Migração: `Receivable.contractId` vira NULLABLE + campo novo `description String?`. Enum `ReceivableKind` ganha `AVULSA`. Constraint `@@unique([contractId, installmentIndex])` — conferir comportamento com null (Postgres permite múltiplos nulls em unique composto; se o Prisma reclamar, mover a unicidade pra validação de aplicação nas parcelas de contrato).
- API: `POST /receivables/standalone` (amount, description, dueDate date-only, paidAt opcional "já recebi" → timestamp `new Date()` se flag, kind=AVULSA, installmentIndex=0); PATCH/DELETE reusa rotas existentes (service valida que avulsa não exige contrato). `listContracts` (tabela por contrato) NÃO muda; endpoint novo `GET /receivables/standalone` lista as avulsas da org.
- Summary/séries: NENHUMA mudança de cálculo — avulsas já entram porque os cálculos filtram por org+datas, não por contrato. Teste provando isso.
- Web A Receber: botão "+ Receita" (dialog descrição/valor/data/checkbox "já recebi") + tabela "Receitas avulsas" (editar/baixar/excluir) entre os cards e a tabela por contrato. Empty state dos gráficos ganha CTA "Lançar receita".

## C) Recorrentes na série mensal de custos

- `GET /costs/usage/series` estendido (aditivo): cada ponto vira `{ month, usageCostBrl, recurringCostBrl, totalCostBrl }` + `yearTotal` continua (consumo) e ganha `yearRecurringTotal`/`yearGrandTotal`.
- `recurringCostBrl[m]` = soma das assinaturas cuja `createdAt` <= fim do mês m e (`isActive` OU mês m < agora? — sem histórico de cancelamento, assinatura INATIVA não tem data de fim conhecida: contar inativa apenas até `updatedAt` dela é chute; decisão: inativa NÃO conta em nenhum mês, ativa conta de createdAt em diante). Documentar a aproximação no código e na UI ("estimado pela data de cadastro").
- YEARLY÷12, USD pela taxa ATUAL (consistente com o resto).
- Web: gráfico de Custos vira barras EMPILHADAS (consumo + recorrente) com a ReferenceLine mantida; dashboard Receita×Custo usa `totalCostBrl` do mês (substitui a soma manual `usageCostBrl + recurringMonthlyBrl` — que era constante).
- "Resultado do ano" passa a usar `yearGrandTotal` (mais honesto que fixo×meses decorridos).

## Validação e entrega

- TDD nos services; suite completa; type-check/lint/build web; validação visual BFF-mock (A Receber com avulsa, Custos empilhado, Configurações com cotação, dashboard).
- Migração: aditiva e retrocompatível; aplicar em produção via `prisma migrate deploy` com DATABASE_URL conferida ANTES (o Render só faz generate, não migra).
- Branch `financeiro-fechamento` → reviews → visual → merge+push → deploy web CLI + Render auto + migração prod (o Rick já pediu deploy desta leva).
