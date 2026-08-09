# Finanças séries mensais + dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Séries mensais reais em recebíveis e custos (com totais do ano e KPIs de contrato com recorte temporal) e um dashboard reorganizado em torno de "receita × custo por mês".

**Architecture:** Monorepo pnpm/Turborepo. `apps/api` (Express, Clean Architecture: rotas → controller → application/services → repositórios Prisma em infrastructure). `apps/web` (Next 15 SPA, react-query, Recharts, tipos espelhados em `src/types/api.ts`, services em `src/services/*`). Agregação mensal segue o padrão já existente: query filtrada no repo + bucketização em memória no service, cortes de mês em UTC com mês corrente resolvido em America/Sao_Paulo.

**Tech Stack:** Express + Prisma + Zod + Vitest (API) · Next 15 + react-query + Recharts (web).

**Spec:** `docs/superpowers/specs/2026-08-09-financas-series-mensais-design.md` (ler antes de cada task — shapes de resposta são contrato).

## Global Constraints

- Nenhuma dependência nova em nenhum dos apps.
- Endpoints novos usam as MESMAS permissões dos irmãos do domínio (`proposals:read` — padrão citado em `receivable-routes.ts:14`).
- Padrão temporal obrigatório: cortes de mês em UTC (`monthRangeUtc`, `apps/api/src/application/services/receivable-service.ts:51-59`) + mês corrente via `currentMonthInTimeZone()` America/Sao_Paulo (mesmo arquivo). NÃO inventar outra convenção.
- **Zero-fill**: toda série mensal retorna exatamente N entradas — mês sem dado entra zerado. Nunca pular mês.
- Decimal como STRING no domínio receivables/contracts (padrão `ReceivableSummary`/`ContractKpis`); NUMBER no domínio costs (padrão `CostSummary`). Respeitar cada um.
- `months` query param: opcional, default 12, clamp 1..24 (Zod `coerce.number().int().min(1).max(24)`).
- Testes: services novos com Vitest ao lado dos existentes (`receivable-service.test.ts` é a referência de estilo). Rodar a suite do apps/api na task.
- Web: sem tocar em banco/produção; validação visual via BFF-mock Playwright (padrão da sessão: cookie `ml_rt` fake + `ctx.route("**/api/bff/**")`; endpoints que o shell chama e PRECISAM ser array: `/leads/activities/recent`, `/notifications`).
- Comentários em PT explicando porquê, no estilo dos arquivos.
- Branch: `financas-series-mensais` a partir da main.

---

### Task 0: Branch + sanidade

- [ ] **Step 1:** `git checkout main && git pull && git checkout -b financas-series-mensais`
- [ ] **Step 2:** Sanidade: `pnpm --filter @millead/api test` (suite atual verde) e `pnpm --filter @millead/web type-check`. Se algo já estiver quebrado, PARAR e reportar.

---

### Task 1: API — série mensal de recebíveis

**Files:**
- Modify: `apps/api/src/application/services/receivable-service.ts` (novo método `series`)
- Modify: `apps/api/src/domain/repositories/receivable-repository.ts` (interface: `listForSeries`)
- Modify: `apps/api/src/infrastructure/prisma/prisma-receivable-repository.ts` (implementação)
- Modify: `apps/api/src/interfaces/http/routes/receivable-routes.ts` + controller + DTO (rota `GET /summary/series`)
- Test: `apps/api/src/application/services/receivable-service.test.ts` (casos novos)

**Interfaces (Produces — contrato pras Tasks 4 e 7):**

```ts
// GET /api/v1/receivables/summary/series?months=12
interface ReceivableSeriesPoint { month: string; received: string; expected: string }
interface ReceivableSeries {
  months: ReceivableSeriesPoint[];       // exatamente N, ordem cronológica asc
  yearTotals: { year: number; received: string; expected: string };
}
```

Semântica: `received` = soma de `amount` com `paidAt` dentro do mês; `expected` = soma de `amount` com `dueDate` dentro do mês (pago ou não). `yearTotals` = mesmas somas no ano corrente (jan/1 UTC do ano corrente America/Sao_Paulo até jan/1 do seguinte).

- [ ] **Step 1: Testes primeiro** em `receivable-service.test.ts` (seguir o estilo dos testes de `summary`, mocks de repo): (a) parcela com dueDate em jul e paidAt em ago conta em `expected` de jul E `received` de ago; (b) mês sem registro vem zerado e a série tem exatamente N entradas; (c) `months` clamp (0→1? não: DTO rejeita; testar service com janela 3); (d) yearTotals soma só o ano corrente. Rodar: `pnpm --filter @millead/api test -- receivable` → novos FALHAM.
- [ ] **Step 2: Repo** — `listForSeries(organizationId, from, to)`: `findMany` com `OR: [{ dueDate: { gte: from, lt: to } }, { paidAt: { gte: from, lt: to } }]` (mesmo estilo de `listForSummary`, `prisma-receivable-repository.ts:142-160`).
- [ ] **Step 3: Service** — `series(organizationId, months = 12)`: resolve mês corrente (`currentMonthInTimeZone`), monta a lista de N chaves `YYYY-MM` retrocedendo, `from` = corte do mês mais antigo, `to` = corte exclusivo do mês seguinte ao corrente; janela do ano corrente calculada à parte (pode extrapolar a janela de N meses — buscar com `min(from, inicioAno)`); bucketização em memória com `Map<string, {received, expected}>` inicializado ZERADO pra todas as chaves; chave do mês derivada da data em UTC (`date.getUTCFullYear()`/`getUTCMonth()`).
- [ ] **Step 4: Rota/controller/DTO** — `router.get("/summary/series", ...)` ANTES de rotas com `/:id` (Express casa na ordem); DTO Zod `months: z.coerce.number().int().min(1).max(24).default(12)`.
- [ ] **Step 5:** Testes passam + suite inteira do api verde.
- [ ] **Step 6:** Commit `feat(api): serie mensal de recebiveis (summary/series)`.

---

### Task 2: API — série mensal de consumo de custos

**Files:**
- Modify: `apps/api/src/application/services/cost-service.ts` (método `getUsageSeries` + extração do custo-por-entrada)
- Modify: `apps/api/src/interfaces/http/routes/cost-routes.ts` + `cost-controller.ts` + DTO
- Test: `apps/api/src/application/services/cost-service.test.ts`

**Interfaces (Produces — contrato pras Tasks 5 e 7):**

```ts
// GET /api/v1/costs/usage/series?months=12
interface CostUsageSeriesPoint { month: string; usageCostBrl: number }
interface CostUsageSeries {
  months: CostUsageSeriesPoint[];      // exatamente N, asc
  yearTotal: number;                   // consumo do ano corrente
  recurringMonthlyBrl: number;         // totalMonthlyBrl atual (mesma conta do getSummary)
}
```

- [ ] **Step 1: Testes primeiro**: (a) lançamentos em meses distintos caem nos buckets certos por `usedAt`; (b) zero-fill; (c) custo por entrada respeita snapshot `unitPriceBrl` quando presente e deriva da assinatura quando ausente (MESMA regra do `computeUsageSummary`, `cost-service.ts:130-194` — se a regra estiver inline, extrair função pura `entryCostBrl(entry, subscription, rate)` e reusar nos dois lugares, sem duplicar); (d) `recurringMonthlyBrl` = soma do `getSummary` atual. Rodar → FALHAM.
- [ ] **Step 2: Implementar** `getUsageSeries(organizationId, months = 12)`: janela como na Task 1 (helpers `monthRangeUtc`/`currentMonthInTimeZone` deste service, `cost-service.ts:197-215`); UMA chamada `this.repository.listUsage(organizationId, { from, to })` com a janela inteira (o método já aceita range — `prisma-cost-repository.ts:199-209`); bucketizar por `usedAt` UTC; ano corrente idem Task 1.
- [ ] **Step 3: Rota** `GET /usage/series` ANTES de `/usage/:id`-like (conferir ordem no arquivo) + DTO `months` idem Task 1.
- [ ] **Step 4:** Testes verdes + suite inteira.
- [ ] **Step 5:** Commit `feat(api): serie mensal de consumo de custos (usage/series)`.

---

### Task 3: API — KPIs de contrato com recorte temporal

**Files:**
- Modify: `apps/api/src/infrastructure/prisma/prisma-contract-repository.ts:185-201` (método `kpis`)
- Modify: tipo `ContractKpis` (onde estiver declarado no domínio/DTO da API)
- Test: teste do repositório ou service de contratos (seguir onde os testes de kpis vivem; se não houver, criar teste de service com repo mockado validando o shape)

**Interfaces (Produces — contrato pras Tasks 6 e 7):** resposta de `GET /contracts/kpis` ganha `valorFechadoMes: string` e `valorFechadoAno: string` (aditivo, sem breaking change). Base temporal: `assinadoEm` dentro do mês/ano corrente (America/Sao_Paulo + cortes UTC — copiar os helpers na cabeça do repo ou importar de um util local se já existir; NÃO mudar a convenção). Contrato ASSINADO com `assinadoEm` null conta só no lifetime.

- [ ] **Step 1:** Teste primeiro (shape + null assinadoEm fora do mês/ano).
- [ ] **Step 2:** Implementar com 2 `aggregate` extras no `Promise.all` (where `status: "ASSINADO", assinadoEm: { gte, lt }`).
- [ ] **Step 3:** Suite verde. Commit `feat(api): valorFechadoMes/Ano nos KPIs de contrato`.

---

### Task 4: Web — /receivables com gráfico de 12 meses e totais do ano

**Files:**
- Modify: `apps/web/src/types/api.ts` (tipos `ReceivableSeriesPoint`/`ReceivableSeries` — copiar da Task 1)
- Modify: `apps/web/src/services/receivables.ts` (método `series(months?)`)
- Modify: `apps/web/src/features/receivables/hooks.ts` (`useReceivablesSeries`)
- Create: `apps/web/src/features/receivables/components/monthly-chart.tsx`
- Modify: `apps/web/src/app/(app)/receivables/page.tsx`

- [ ] **Step 1:** Tipos + service + hook (react-query, staleTime na linha dos hooks vizinhos).
- [ ] **Step 2:** `monthly-chart.tsx`: Recharts `BarChart` com 2 barras por mês (`received` = "Recebido", `expected` = "Previsto"), eixo X com rótulo curto `ago/25` (derivar do `YYYY-MM` SEM `new Date(month)` puro — parse manual `split("-")` pra não cair no fuso), tooltip com `formatCurrency` já usado na página, legenda. Card wrapper no padrão visual da tela.
- [ ] **Step 3:** Página: gráfico entre os StatCards e as tabelas; 2 StatCards novos "Recebido no ano"/"Previsto no ano" (yearTotals); no card "Vencidas", sublabel "acumulado geral (não segue o mês)" (a auditoria mostrou que ele ignora o seletor e parece bug).
- [ ] **Step 4:** `pnpm --filter @millead/web type-check && pnpm --filter @millead/web lint`. Commit `feat(web): grafico mensal e totais do ano em A Receber`.

---

### Task 5: Web — /costs com histórico de consumo

**Files:**
- Modify: `apps/web/src/types/api.ts` (+`CostUsageSeries*`), `apps/web/src/services/costs.ts`, `apps/web/src/features/finance/hooks.ts` (`useUsageSeries`)
- Create: `apps/web/src/features/finance/components/usage-history-section.tsx`
- Modify: `apps/web/src/app/(app)/costs/page.tsx` (montar a seção acima do CreditUsageSection)

- [ ] **Step 1:** Tipos + service + hook.
- [ ] **Step 2:** Seção: BarChart 12 meses de `usageCostBrl` + `ReferenceLine` horizontal do `recurringMonthlyBrl` rotulada "custo fixo atual" + card "Consumo no ano" (`yearTotal`). Deixar claro no sublabel que o custo fixo é o valor ATUAL (sem histórico de assinaturas — limitação da spec).
- [ ] **Step 3:** type-check + lint. Commit `feat(web): historico mensal de consumo no Centro de Custos`.

---

### Task 6: Web — KPIs de /contracts com mês/ano

**Files:**
- Modify: `apps/web/src/types/api.ts` (`ContractKpis` +2 campos)
- Modify: `apps/web/src/app/(app)/contracts/page.tsx:123-134` (linha de KPIs)

- [ ] **Step 1:** Exibir "Fechado no mês", "Fechado no ano" e o lifetime re-rotulado "Fechado desde o início". Grid acomoda 6 cards (2 linhas ou grid responsivo — seguir padrão visual da página).
- [ ] **Step 2:** type-check + lint. Commit `feat(web): KPIs de contrato com recorte mes/ano`.

---

### Task 7: Web — Dashboard P2

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`
- Modify: `apps/web/src/features/dashboard/hooks.ts` (hooks: séries, overdue list, activities)
- Create: `apps/web/src/features/dashboard/components/revenue-cost-chart.tsx`
- Create: `apps/web/src/features/dashboard/components/overdue-tasks-card.tsx`
- Create: `apps/web/src/features/dashboard/components/recent-activities-card.tsx`
- Create: `apps/web/src/features/dashboard/components/quick-actions.tsx`
- Modify: `apps/web/src/features/dashboard/components/finance-cards.tsx` (granularidade coerente)

**Consumes:** séries das Tasks 1-2 (via services das Tasks 4-5), KPIs da Task 3, `GET /tasks?overdue=true&pageSize=5` (hook já existe pra contagem — criar variação com lista), `GET /leads/activities/recent` (service já existe — é o que o sino usa, `notifications-bell.tsx:105`).

- [ ] **Step 1: `revenue-cost-chart.tsx`** — Recharts `ComposedChart` 12 meses: barras = `received` (recebíveis); linha = custo total do mês (`usageCostBrl + recurringMonthlyBrl`); tooltip com as três grandezas (recebido, consumo, fixo atual); rótulos de mês como na Task 4.
- [ ] **Step 2: `finance-cards.tsx` reorganizado** em 2 linhas rotuladas:
  - "Este mês": A receber (summary atual) · Recebido (summary atual) · Fechado em contratos (`valorFechadoMes`) · Custo mensal atual (`totalMonthlyBrl`).
  - "Ano": Recebido no ano (yearTotals) · Fechado no ano (`valorFechadoAno`) · Consumo no ano (`yearTotal`) · **Resultado do ano** = recebidoAno − (consumoAno + recorrente × meses decorridos do ano) com sublabel "estimativa (custo fixo = valor atual)"; negativo em vermelho.
  - Manter tudo que os cards atuais já linkavam ("ver contratos" etc. — não perder navegação).
- [ ] **Step 3: `overdue-tasks-card.tsx`** (lista 5, borda/acento de alerta, link "ver todas" → /tasks?overdue=true) e **`recent-activities-card.tsx`** (feed compacto tipo o do sino: ação + lead + quando; link pro lead).
- [ ] **Step 4: `quick-actions.tsx`**: 3 botões-link ("+ Lead" → /leads com dialog/rota de criação existente, "+ Tarefa" → /tasks idem, "+ Orçamento" → /estimates/new). Conferir as rotas/gestos de criação REAIS de cada tela antes de linkar (ex.: /estimates/new existe; leads/tarefas podem abrir por query param ou só navegar).
- [ ] **Step 5: `dashboard/page.tsx`** — nova ordem: header+quick actions → RevenueCostChart → FinanceCards (2 linhas) → CostSummaryTiles (mantido) → StatCards → funil+pizza → 3 colunas Próximas tarefas · Atrasadas · Próximas reuniões → Atividades recentes.
- [ ] **Step 6:** type-check + lint + `pnpm --filter @millead/web build`. Commit `feat(web): dashboard com receita x custo mensal, atrasadas, feed e atalhos`.

---

### Task 8: Validação visual + entrega

- [ ] **Step 1:** Build + `next start` (porta 3010) do web; script BFF-mock Playwright (padrão da sessão; scratchpad tem `millead-milsocial-check.js` de exemplo): mockar TODOS os endpoints usados (séries de 12 meses fictícias com meses zerados no meio pra provar o zero-fill visual, kpis, summaries, tasks/meetings/activities como arrays). Screenshots: /dashboard (topo e baixo), /receivables, /costs, /contracts. ABRIR os PNGs e conferir: gráfico com 12 meses SEM buraco, rótulos de mês certos, cards coerentes, listas novas renderizando.
- [ ] **Step 2:** Suite completa da API + type-check/lint/build web de novo no fim.
- [ ] **Step 3:** Review final whole-branch (controller despacha) → fix wave se precisar → prints pro Rick → merge na main + push. Deploy só com pedido explícito.
