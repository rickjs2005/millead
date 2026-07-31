# Módulo Financeiro — Fase 4: Capacidade + Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Barras de utilização da infraestrutura com alerta ≥80% no Centro de Custos, e cards financeiros + alerta de capacidade no Dashboard.

**Architecture:** Spec: seção "Frontend /costs (capacidade)" e "Dashboard" de `docs/superpowers/specs/2026-07-31-financeiro-custos-calculadora-design.md`. Fases 1-3 no ar. Dados de capacidade (`capacityUsed`/`capacityLimit`) já existem em `CostSubscription` e já são editáveis no dialog — esta fase só ADICIONA a visualização e o agregado. **Zero migração.**

**Tech Stack:** idêntico às fases anteriores. `components/ui/progress` (shadcn) já existe no repo.

## Global Constraints

- Mesmas das fases anteriores (imports `.js`, org-scoped, `proposals:read` p/ leitura, pt-BR).
- Regra de alerta: utilização = `capacityUsed/capacityLimit`; **≥80% = atenção (âmbar), ≥100% = estourado (vermelho)**. Assinaturas sem os dois campos ou inativas ficam FORA da lista de capacidade.
- Dashboard não cria endpoint novo — reusa `GET /api/v1/costs/summary` (estendido na Task 1) via `useCostSummary` existente. Cards seguem o padrão real de `features/dashboard/components/finance-cards.tsx`/`stat-card.tsx` e o gating por permissão do dashboard atual (`proposals:read`).

---

### Task 1: API — capacidade no `GET /costs/summary` + testes

**Files:**
- Modify: `apps/api/src/application/services/cost-service.ts` + `cost-service.test.ts`
- Modify: `apps/api/src/domain/entities/cost.ts` (estender `CostSummary`)

**Interfaces:**
- `CostSummary` ganha:

```ts
export interface CapacityEntry {
  id: string;
  name: string;
  used: number;
  limit: number;
  pct: number; // 0-999, arredondado, = round(used/limit*100); limit 0 é excluído da lista
}
// em CostSummary:
capacity: CapacityEntry[];      // só assinaturas ativas com used!=null e limit!=null e limit>0, ordenadas por pct desc
maxCapacityPct: number | null;  // null quando capacity vazia
```

- Implementar como função pura exportada `computeCapacity(subscriptions): { capacity, maxCapacityPct }` chamada por `computeSummary` (que passa a receber as assinaturas com `id`/`name`/`capacityUsed`/`capacityLimit` — ajustar o tipo `SummarySubscription` e o mapeamento no `getSummary`).

- [ ] **Step 1 (TDD): testes primeiro** — casos: assinatura 12/15 → pct 80 e entra; 1/1 → 100; sem limit/used → fora; inativa → fora; limit 0 → fora; ordenação por pct desc; `maxCapacityPct` = maior pct; lista vazia → `maxCapacityPct: null`. Ajustar os testes existentes de `computeSummary` (o shape do retorno mudou — adicionar os 2 campos esperados).
- [ ] **Step 2:** FAIL → **Step 3:** implementar → **Step 4:** PASS + suíte completa (53 + novos) + type-check/lint.
- [ ] **Step 5:** Espelhar o tipo no web: `types/api.ts` (`CapacityEntry`, campos novos em `CostSummary`) — no MESMO commit pra não quebrar type-check do web.
- [ ] **Step 6:** Commit `feat(api): capacidade da infraestrutura no resumo de custos`.

---

### Task 2: Web — seção Capacidade no /costs

**Files:**
- Create: `apps/web/src/features/finance/components/capacity-section.tsx`
- Modify: `apps/web/src/app/(app)/costs/page.tsx` (inserir a seção entre os cards e a tabela)

**Interfaces:** consome `useCostSummary()` (campo `capacity` novo). `Progress` de `components/ui/progress` (conferir a API real do componente — value 0-100).

- [ ] **Step 1:** `capacity-section.tsx` — `Card` "Capacidade da infraestrutura": para cada `CapacityEntry`: linha com nome, `{used}/{limit} projetos`, `Progress` (value = min(pct,100)) com cor por faixa (padrão: primária <80, âmbar 80-99, destructive ≥100 — conferir como Progress aceita cor: className no indicator ou wrapper; seguir o que o componente real permite), e badge "Atenção"/"Estourado" nas faixas de alerta. Estado vazio: texto "Defina limite e uso nas assinaturas para acompanhar a capacidade." Skeleton no loading. Dica no rodapé: "Edite os números na própria assinatura." 
- [ ] **Step 2:** montar na página `/costs`. `pnpm turbo lint type-check --filter=@millead/web`.
- [ ] **Step 3:** Commit `feat(web): barras de capacidade da infraestrutura no Centro de Custos`.

---

### Task 3: Web — Dashboard (cards + alerta) + suíte

**Files:**
- Create: `apps/web/src/features/dashboard/components/cost-summary-tiles.tsx`
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx` (ou o componente que monta os cards — conferir onde `FinanceCards` é renderizado e inserir junto)

**Interfaces:** `useCostSummary` + `useAuthStore(hasPermission)` — só renderiza com `proposals:read` (padrão do `FinanceCards` — conferir e copiar o gating real).

- [ ] **Step 1:** `cost-summary-tiles.tsx`: 2 `StatCard` — "Custo fixo mensal" (`agencyMonthlyBrl`, descrição "assinaturas da agência") e "Custo por cliente ativo" (`perClientShareBrl`, descrição "rateio entre N clientes"); + quando `maxCapacityPct >= 80`: banner/linha de alerta compacta (âmbar; vermelha se ≥100) "Infraestrutura em {pct}% — veja o Centro de Custos" com link `/costs`.
- [ ] **Step 2:** montar no dashboard junto dos FinanceCards. Lint/type-check.
- [ ] **Step 3:** Suíte CI completa (`pnpm turbo lint type-check build` + vitest API; format:check CRLF pré-existente ignorável).
- [ ] **Step 4:** Commit `feat(web): custos e alerta de capacidade no dashboard`.
- [ ] **Step 5 (controlador):** review final da branch + checkpoint com o Rick (merge/push só com OK).

## Self-review do plano

- Cobre a spec da Fase 4: barras+alerta ≥80% ✓, campos editáveis (já existiam) ✓, 2 cards no dashboard via summary ✓, alerta no dashboard ✓. Sem migração ✓, endpoint reusado ✓.
- Tipos: `CapacityEntry` definido na Task 1 e espelhado no web no mesmo commit; Tasks 2-3 só consomem.
