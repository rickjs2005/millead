# Fechamento do financeiro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cotação USD→BRL automática, receita avulsa sem contrato, e custos recorrentes na série mensal — fechando os buracos que deixam os meses vazios com dinheiro real.

**Architecture:** Mesma dos épicos anteriores (apps/api Clean Arch + apps/web Next 15). Migrações Prisma ADITIVAS (packages/database). Cotação por fetch lazy com cache 24h no read de settings. Receita avulsa = Receivable com contractId null. Recorrentes na série = extensão aditiva do usage/series.

**Spec:** `docs/superpowers/specs/2026-08-09-financeiro-fechamento-design.md` — ler antes de cada task; decisões de semântica (inativa não conta, USD taxa atual, lazy 24h com fallback) estão lá e são contrato.

## Global Constraints

- Nenhuma dependência nova (fetch nativo do Node 18+ pra cotação).
- Migrações aditivas e retrocompatíveis; NUNCA rodar `migrate deploy`/`db push` contra produção dentro das tasks — só na entrega final, pelo controller.
- Falha da API de cotação NUNCA propaga erro pro caller — fallback no valor persistido + log.
- Cortes temporais seguem a convenção por campo do épico anterior: `dueDate` date-only corte UTC; `paidAt` timestamp corte SP (receita avulsa idem: dueDate UTC, paidAt SP).
- Séries continuam zero-fill; extensões de resposta são ADITIVAS (front antigo não quebra).
- TDD nos services; suite `pnpm --filter @millead/api test` verde por task; web `type-check && lint && build` verde por task.
- Comentários em PT explicando porquê. Branch: `financeiro-fechamento`.

---

### Task 0: Branch + sanidade
- [ ] `git checkout main && git pull && git checkout -b financeiro-fechamento`; suite api + type-check web verdes.

### Task 1: Migração dupla (schema) + prisma generate
**Files:** `packages/database/prisma/schema.prisma` + nova migração SQL via `pnpm --filter @millead/database exec prisma migrate dev --name financeiro_fechamento` (roda contra o banco de DEV configurado — conferir DATABASE_URL antes; se apontar pra produção, PARAR e usar `prisma migrate diff` pra gerar o SQL sem aplicar, registrando no relatório).
**Produces:** `FinanceSettings.usdRateAuto Boolean @default(true)`, `FinanceSettings.usdRateUpdatedAt DateTime?`; `Receivable.contractId String?` (nullable), `Receivable.description String?`, enum `ReceivableKind` + `AVULSA`. Relação `contract Contract?` opcional. Verificar unique composto com null (Postgres aceita; testar generate+push local).
- [ ] Steps: alterar schema → gerar migração → `prisma generate` → suite api ainda verde (nada consome os campos ainda) → commit.

### Task 2: API cotação automática
**Files:** `apps/api/src/application/services/cost-service.ts` (ou serviço novo `finance-rate-service.ts` se ficar mais limpo), DTO/rotas de settings, testes.
**Produces:** `getSettings()` com refresh lazy: se `usdRateAuto && (updatedAt null || >24h)` → fetch AwesomeAPI `https://economia.awesomeapi.com.br/json/last/USD-BRL` (timeout 3s, valida `USDBRL.bid` numérico 1..20) → persiste rate+`usdRateUpdatedAt`. Falha → log + valor persistido. PATCH settings: rate manual ⇒ `usdRateAuto=false`; aceita religar `usdRateAuto=true`. Resposta de settings expõe os 2 campos.
- [ ] TDD: fetch mockado (sucesso atualiza; falha usa persistido; <24h não busca; manual desliga auto). Injetar o fetcher (parâmetro/propriedade) pra testar sem rede. Suite verde. Commit.

### Task 3: API receita avulsa
**Files:** receivable-service/repository/rotas/DTOs + testes.
**Produces:** `POST /api/v1/receivables/standalone` {amount, description, dueDate, alreadyPaid?: boolean} → cria kind=AVULSA, contractId null, installmentIndex 0, paidAt=`new Date()` se alreadyPaid. `GET /api/v1/receivables/standalone` lista avulsas (org, ordenadas por dueDate desc). PATCH/DELETE existentes funcionam pra avulsa (validar que update de avulsa não exige contrato). Permissões `proposals:*` como os irmãos. Rotas `/standalone` ANTES das paramétricas.
- [ ] TDD: criação com/sem alreadyPaid; summary e series INCLUEM avulsas (teste explícito provando — é o coração da dor do Rick); unicidade de parcelas de contrato intacta. Suite verde. Commit.

### Task 4: API recorrentes na série
**Files:** cost-service + testes.
**Produces:** `getUsageSeries` estendido: pontos `{month, usageCostBrl, recurringCostBrl, totalCostBrl}` + `yearRecurringTotal` + `yearGrandTotal` (aditivo — campos antigos intactos). `recurringCostBrl[m]` = assinaturas ATIVAS com `createdAt` <= fim do mês m (corte UTC — createdAt é timestamp mas a aproximação declarada dispensa precisão de fuso; comentar), YEARLY÷12, USD taxa atual. Inativa não conta em mês nenhum (aproximação documentada).
- [ ] TDD: assinatura criada no meio da janela só conta dos meses dela em diante; inativa não conta; totais do ano. Suite verde. Commit.

### Task 5: Web — as três frentes
**Files:** types/api.ts, services, hooks, `apps/web/src/app/(app)/receivables/page.tsx` + componentes novos (`standalone-dialog.tsx`, `standalone-table.tsx`), `usage-history-section.tsx` (barras empilhadas), `revenue-cost-chart.tsx` + `finance-cards.tsx` (usar totalCostBrl/yearGrandTotal), UI de Configurações de custos (cotação + toggle).
- [ ] A Receber: botão "+ Receita" (dialog: descrição, valor, data com default hoje, checkbox "já recebi"), tabela de avulsas com baixar/editar/excluir (mutations invalidando prefixo ["receivables"]), CTA no empty do gráfico.
- [ ] Custos: barras empilhadas consumo+recorrente (cores distintas, legenda), sublabel "recorrente estimado pela data de cadastro"; Configurações mostram cotação atual + "atualizada em" + toggle auto.
- [ ] Dashboard: linha de custo do Receita×Custo usa `totalCostBrl` por mês; "Resultado do ano" usa `yearGrandTotal`; sublabel do card atualizado ("custos do ano (consumo + assinaturas)").
- [ ] type-check/lint/build verdes. Commit por frente ou único — critério do implementador, mensagens claras.

### Task 6: Validação visual + entrega
- [ ] BFF-mock Playwright (padrão da sessão; estender millead-financas-check.js): A Receber com avulsas na tabela e no summary; Custos empilhado; dashboard com totalCost; shot da Configuração com cotação. OLHAR os prints.
- [ ] Review final whole-branch (controller despacha) → fix wave se preciso → merge+push.
- [ ] Entrega (controller): migração em produção (conferir DATABASE_URL alvo ANTES; `prisma migrate deploy`), deploy web CLI + verificação do domínio, Render auto (conferir /health commit), smoke em produção: criar e excluir uma receita avulsa de teste via UI? NÃO — produção do Rick: só verificar que as telas carregam; o Rick lança a receita real dele.
