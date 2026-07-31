# Módulo Financeiro — Fase 5: Créditos por cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Custo por consumo: créditos do Higgsfield estimados no orçamento (custo único) e registrados por cliente no Centro de Custos; rateio da agência zerado por padrão na calculadora.

**Architecture:** Spec: seção "Fase 5 — Créditos por cliente" de `docs/superpowers/specs/2026-07-31-financeiro-custos-calculadora-design.md`. Fases 1-4 no ar (main `402c340`+). Padrões idênticos às fases anteriores.

## Global Constraints

- Mesmas das fases anteriores. Migrations aditivas com RLS na tabela nova.
- Preço unitário do crédito = `monthlyAmountBrl(assinatura) ÷ creditsIncluded` — SEMPRE derivado, nunca digitado (mudou o plano/câmbio, muda o unitário).
- Créditos em orçamento = custo **one-time** (não multiplica por infraMonths). O split one-time/mensal no `computeEstimate` precisa ser idêntico API ↔ espelho client.
- Rateio default 0 em orçamento NOVO; orçamentos existentes não mudam (valor persistido).

## Verificações de ambiente

- `git checkout main && git checkout -b feat/finance-credits`; conferir `git log --oneline -1` ≥ `402c340`. Commitar a spec atualizada (já editada pelo controlador) junto com o plano no 1º commit da branch.

---

### Task 1: DB — creditsIncluded, isOneTime, CostUsageEntry + seed

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: migration `add_credit_usage` (RLS na tabela nova)
- Modify: `packages/database/prisma/seed-data/finance.ts`

- [ ] **Step 1: Schema** — em `CostSubscription`: `creditsIncluded Int? @map("credits_included")`. Em `PricingEstimateCost`: `isOneTime Boolean @default(false) @map("is_one_time")`. Model novo:

```prisma
model CostUsageEntry {
  id             String   @id @default(cuid())
  organizationId String   @map("organization_id")
  subscriptionId String   @map("subscription_id")
  companyId      String?  @map("company_id")
  credits        Int
  usedAt         DateTime @map("used_at")
  note           String?
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization     @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  subscription CostSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  company      Company?         @relation(fields: [companyId], references: [id], onDelete: SetNull)

  @@index([organizationId, usedAt])
  @@index([organizationId, subscriptionId])
  @@map("cost_usage_entries")
}
```

(+ relações inversas em Organization/CostSubscription/Company.)
- [ ] **Step 2:** migration `--create-only` → conferir aditiva → append `ALTER TABLE "cost_usage_entries" ENABLE ROW LEVEL SECURITY;` → `pnpm db:migrate` + `db:generate`. Drift/reset → BLOCKED.
- [ ] **Step 3: Seed** — `higgsfield-starter` do catálogo ganha nota de créditos em `billingNotes` e o bootstrap `RICK_SUBSCRIPTIONS` ganha `creditsIncluded: 1000` no item Higgsfield. **Rodar `pnpm db:seed` NÃO atualiza a assinatura já existente do Rick** (bootstrap só roda em org sem assinaturas) — em vez disso, atualizar a assinatura real em produção com um script one-off via Prisma (update WHERE serviceKey='higgsfield-starter' AND credits_included IS NULL SET credits_included=1000), rodado e descartado; registrar o output no relatório.
- [ ] **Step 4:** type-check + commit `feat(db): créditos por assinatura, custo one-time e lançamentos de consumo`.

---

### Task 2: API — usage CRUD + summary de consumo + cálculo one-time

**Files:**
- Modify: `apps/api/src/application/dto/cost.dto.ts` (subscription ± `creditsIncluded`; novos `createUsageEntrySchema {subscriptionId min1, companyId opcional nullable, credits int 1..1_000_000, usedAt coerce.date, note max 200 opcional}` e `usageQuerySchema {month "YYYY-MM" opcional}`)
- Modify: `apps/api/src/domain/entities/cost.ts` (`CostUsageEntry` com `companyName: string | null` denormalizado na leitura; `UsageSummary`)
- Modify: `apps/api/src/domain/repositories/cost-repository.ts` + prisma impl (`listUsage(orgId, {from,to})` com include company {name}, `createUsage`, `deleteUsage` org-scoped)
- Modify: `apps/api/src/application/services/cost-service.ts` + testes (`getUsageSummary`)
- Modify: `apps/api/src/application/services/estimate-calc.ts` + testes (`isOneTime`)
- Modify: `apps/api/src/application/services/estimate-service.ts` (rateio default 0; mapear isOneTime)
- Modify: `apps/api/src/application/dto/estimate.dto.ts` (`costItemSchema` + `isOneTime boolean default false`)
- Modify: `apps/api/src/interfaces/http/{controllers/cost-controller.ts,routes/cost-routes.ts}`

**Interfaces:**

```ts
export interface UsageSummary {
  month: string; // "2026-07"
  unitPriceBrl: number | null;    // por assinatura com creditsIncluded (ver bySubscription)
  totalCredits: number;
  bySubscription: { subscriptionId: string; name: string; credits: number; creditsIncluded: number | null; unitPriceBrl: number | null; costBrl: number }[];
  byClient: { companyId: string | null; companyName: string; credits: number; costBrl: number }[]; // companyId null => "Sem cliente"
}
```

- `getUsageSummary(orgId, month?)`: default mês corrente (America/Sao_Paulo); custo = credits × unitPrice da assinatura do lançamento; função pura `computeUsageSummary(entries, subscriptions, usdRate)` exportada + testes (unitário derivado, agregação por cliente, assinatura sem creditsIncluded → unitPrice null e costBrl 0, mês vazio).
- `computeEstimate`: `costItems[].isOneTime?` — one-time somados 1× em `infraCost` (novo campo no retorno: `oneTimeCost` para exibição; `infraCost = (monthly+share)×months + oneTimeCost`). Ajustar testes existentes + novos (item one-time não multiplica; misto).
- `EstimateService.create`: **não** auto-preencher `agencyShareMonthly` (default 0 quando ausente — remover o `defaultAgencyShareMonthly`; manter o summary disponível pro front via /costs/summary). Ajustar teste que cobria o auto-fill.
- Rotas: `GET /usage` (read, validateQuery), `POST /usage` (write, valida subscriptionId da org e companyId da org quando presente), `DELETE /usage/:id` (write), `GET /usage/summary` (read). Registradas antes de rotas `/:id` de assinatura.
- TDD; suíte completa; type-check/lint. Commit `feat(api): consumo de créditos por cliente e custo one-time no orçamento`.

---

### Task 3: Web — tipos/hooks + UI de consumo + calculadora

**Files:**
- Modify: `apps/web/src/types/api.ts`, `services/costs.ts`, `lib/query-keys.ts` (`costs.usage(month)`, `costs.usageSummary(month)`), `features/finance/hooks.ts` (useUsage, useUsageSummary, useCreateUsage, useDeleteUsage; invalidação namespace costs)
- Modify: `features/finance/components/cost-subscription-dialog.tsx` (campo "Créditos inclusos/mês" opcional int; mostrar "≈ R$ X por crédito" quando amount+credits presentes)
- Create: `features/finance/components/credit-usage-section.tsx` — no `/costs` (abaixo da capacidade): resumo do mês (total usado / incluído com Progress e o mesmo esquema de cores da capacidade ≥80/≥100), tabela por cliente (nome, créditos, custo R$), lista de lançamentos (data, assinatura, cliente, créditos, nota, excluir com ConfirmDialog), dialog "Lançar consumo" (assinatura [só com creditsIncluded], CompanyCombobox opcional — conferir o combobox de empresa existente usado no prompt-builder —, créditos, data default hoje, nota), navegação de mês (◀ mês ▶)
- Modify: `apps/web/src/app/(app)/costs/page.tsx` (montar seção)
- Modify: `features/estimates/estimate-calc.ts` (espelhar isOneTime/oneTimeCost), `estimate-editor.tsx` e `estimate-result-panel.tsx`:
  - Rateio: default 0 em novo orçamento; hint "Rateio calculado hoje: R$ X — [Usar]" (botão preenche).
  - Estimador de créditos: para cada assinatura ativa com `creditsIncluded`, linha "Créditos {nome}: [input créditos] × R$ {unit} = R$ Y" que cria/atualiza um costItem `isOneTime: true` label `"{nome} ({N} créditos)"`; itens one-time aparecem na lista com badge "único" e SEM sufixo /mês.
  - Painel: linha "Custos únicos (créditos)" quando > 0; "Infra + rateio no período" continua só com os mensais.
- Types payload: `EstimateCostItemPayload.isOneTime?`.
- Lint/type-check/dev compila. Commit `feat(web): consumo de créditos por cliente e estimador na calculadora`.

---

### Task 4: Suíte + review final + checkpoint (controlador)

- [ ] CI completo + vitest API; review final da branch; checkpoint com o Rick (merge/push só com OK).

## Self-review do plano

- Cobre a Fase 5 da spec: creditsIncluded ✓, CostUsageEntry+RLS ✓, one-time no cálculo (API+client) ✓, usage CRUD+summary por cliente ✓, UI de lançamentos+resumo mensal ✓, estimador na calculadora ✓, rateio default 0 com botão ✓, assinatura real do Rick atualizada via one-off ✓, PDF intacto ✓.
- Consistência: `UsageSummary`/`oneTimeCost` definidos na Task 2 e espelhados na Task 3; unitPrice sempre derivado.
