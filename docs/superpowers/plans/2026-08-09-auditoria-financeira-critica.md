# Auditoria financeira — correções críticas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar os dois riscos reais da auditoria final: parcela editável sem revalidar o total do contrato, e erro de rede virando "R$ 0,00"/"0" silencioso em ~10 pontos das telas financeiras.

**Architecture:** apps/api Clean Arch (TDD) para o invariante; apps/web (react-query) propagando `isError` até a UI, seguindo o padrão já correto de `finance-cards.tsx`/`revenue-cost-chart.tsx`.

**Spec:** `docs/superpowers/specs/2026-08-09-auditoria-financeira-critica-design.md`

## Global Constraints

- Nenhuma dependência nova.
- `SUM_TOLERANCE = 0.01` (já existe em `receivable-service.ts`) — reusar, não duplicar.
- Trava de invariante só se aplica a recebível com `contractId != null`; avulsa nunca bloqueia.
- Parcela paga não pode ter valor editado (comportamento já existente — CONFIRMAR e preservar, não reimplementar).
- Padrão de erro: nunca `data ?? 0`/`?? []` sem checar `isError` antes. Usar `ErrorState` (`apps/web/src/components/error-state.tsx`) para blocos de conteúdo; para `StatCard` pequeno, valor `null` (já produz "—" via `formatCurrency`) ou indicador inline — critério do implementador, mas CONSISTENTE com `finance-cards.tsx`.
- TDD na API; suite completa verde por task. Web: type-check/lint/build verde por task.
- Comentários em PT explicando porquê. Branch: `auditoria-financeira-critica`.

---

### Task 0: Branch + sanidade

- [ ] `git checkout main && git pull && git checkout -b auditoria-financeira-critica`; suite api + type-check web verdes.

### Task 1: API — revalidar total do contrato em update/remove de parcela

**Files:** `apps/api/src/application/services/receivable-service.ts`, `receivable-service.test.ts`.

**Produces:** `update()` e `remove()` lançam `Conflict` (mesma classe de erro que `createPlan`/pagamento de parcela já usam — confira o nome exato no arquivo) quando a operação, aplicada a um recebível com `contractId != null`, deixaria `|soma_pos_operacao - contract.valorTotal| > SUM_TOLERANCE`. Mensagem clara citando os dois valores.

- [ ] **Step 1 — ler o código atual**: releia `update()` e `remove()` inteiros (linhas ~254-275 na auditoria, confirme no arquivo real) e o bloqueio existente de editar/excluir parcela PAGA. Documente no relatório se `remove()` de parcela paga já bloqueia (esperado) ou não (se não bloquear, isso NÃO é escopo desta task corrigir — só não quebrar o que já existe).
- [ ] **Step 2 — testes primeiro**: (a) update de amount de parcela aberta que MANTÉM a soma (diff dentro de tolerância, ex. compensando em outra parcela não é possível num único PATCH — então o teste real é: update que quebra a soma sozinho deve falhar; um update que efetivamente mantém não existe isoladamente a menos que a parcela seja a única — cubra o caso realista: parcela única de valor X editada pra X (idempotente, passa) e editada pra X+100 (falha)); (b) update de parcela de AVULSA pra qualquer valor NUNCA bloqueia por este motivo; (c) remove de parcela aberta que deixa a soma divergente → Conflict; (d) remove que não deixa (ex. eram 2 parcelas parcialmente compensáveis — se não existir cenário realista de remove "seguro", teste que QUALQUER remove de parcela de contrato com >1 parcela aberta falha, documentando que isso é o comportamento esperado: remoção de parcela de contrato SEMPRE quebra a soma a menos que seja a única parcela e o contrato tenha valorTotal 0, caso de borda improvável — ajuste o teste à realidade que você encontrar); (e) mensagem de erro contém os dois valores (atual pós-operação e o esperado). Rodar → FALHAM.
- [ ] **Step 3 — implementar**: em `update()`, antes de persistir a mudança de `amount`, se o recebível tiver `contractId`, buscar todos os recebíveis do contrato (repo já deve ter algo tipo `listByContract` — reusar), calcular a soma hipotética (as demais parcelas como estão + esta com o valor novo) e comparar contra `contract.valorTotal` (buscar o contrato — repo de contracts já é injetado no service? confira; se não, adicione a dependência mínima necessária). Em `remove()`, mesma lógica com a parcela removida do cálculo.
- [ ] **Step 4**: suite completa `pnpm --filter @millead/api test` verde. Commit: `feat(api): trava edicao/exclusao de parcela que quebraria o total do contrato`.

Relatório em: `.superpowers/sdd/2026-08-09-auditoria-financeira-critica/task-1-report.md`.

### Task 2: Web — A Receber (página + gráfico mensal) sem erro silencioso

**Files:** `apps/web/src/app/(app)/receivables/page.tsx`, `apps/web/src/features/receivables/components/monthly-chart.tsx`.

- [ ] Os 3 StatCards do topo (A receber/Vencidas/Recebido no mês) passam a considerar `summary.isError`: em erro, valor vira `null` (renderiza "—") OU o bloco inteiro vira um `ErrorState` compacto com retry (`refetch` do react-query) — escolha consistente com o resto da página.
- [ ] Os 2 StatCards do ano (Recebido/Previsto no ano) idem considerando `series.isError`.
- [ ] O `isError` geral da página (hoje só considera `summary`/`contracts`) passa a incluir `series.isError` também, se a página tiver um estado de erro de página inteira — senão, tratar local por bloco como acima.
- [ ] `monthly-chart.tsx`: `useReceivablesSeries` passa a expor `isError`; em erro, renderizar `ErrorState` (com retry) no lugar do gráfico, NUNCA o empty-state "Sem movimento".
- [ ] type-check/lint/build verdes. Commit: `fix(web): erro de rede em A Receber nao vira R$ 0,00/vazio`.

### Task 3: Web — Custos (cards, capacidade, histórico) sem erro silencioso

**Files:** `apps/web/src/features/finance/components/cost-summary-cards.tsx`, `capacity-section.tsx`, `usage-history-section.tsx`.

- [ ] `cost-summary-cards.tsx`: os 4 cards passam a considerar `isError` do `useCostSummary` (mesmo tratamento de `finance-cards.tsx` como referência).
- [ ] `capacity-section.tsx`: mesmo hook, mesmo tratamento — erro não pode ficar indistinguível de "nenhuma assinatura com capacidade definida".
- [ ] `usage-history-section.tsx`: `useUsageSeries` expõe `isError`; em erro, `ErrorState` no lugar do gráfico empilhado, nunca "Sem custo lançado".
- [ ] type-check/lint/build verdes. Commit: `fix(web): erro de rede em Custos nao vira zero/vazio`.

### Task 4: Web — Dashboard (cost tiles + contadores) sem erro silencioso

**Files:** `apps/web/src/features/dashboard/components/cost-summary-tiles.tsx`, `apps/web/src/features/dashboard/hooks.ts`, componentes de StatCard do dashboard que consomem `useDashboardCounts`.

**Interfaces (Consumes):** nenhuma nova — usa os mesmos hooks já existentes de contagem (`leads`, `tasks`, `meetings`, `proposals`, `briefings`).

- [ ] `cost-summary-tiles.tsx`: alinhar com o tratamento que `finance-cards.tsx` JÁ FAZ pro mesmo `useCostSummary` (é literalmente copiar o padrão já correto na mesma página).
- [ ] `useDashboardCounts` (`hooks.ts`): as 12 queries passam a expor um `isError` agregado OU individual por métrica (critério do implementador — agregado é mais simples se todas alimentam os mesmos StatCards de forma homogênea; individual é mais preciso se um contador pode falhar sem os outros). Propagar pro(s) componente(s) de `StatCard` que hoje mostram contagem: erro vira "—" ou indicador, nunca "0".
- [ ] type-check/lint/build verdes. Commit: `fix(web): dashboard nao mostra 0 quando contagem falha`.

### Task 5: Web — Contratos (KPIs + detalhe) sem erro silencioso

**Files:** `apps/web/src/app/(app)/contracts/page.tsx`, `apps/web/src/app/(app)/contracts/[id]/page.tsx`.

- [ ] `contracts/page.tsx`: `useContractKpis` ganha loading (skeleton) e `isError` (ErrorState com retry) — hoje a fileira de KPIs simplesmente não renderiza em ambos os casos sem feedback.
- [ ] `contracts/[id]/page.tsx`: distinguir 404 real (contrato não existe) de erro de rede/servidor transitório. Se `useContract` já expõe algo como `error` com status HTTP, usar isso; senão, expor `isError` do hook e, quando `isError && !isLoading`, mostrar `ErrorState` com retry EM VEZ DE "Contrato não encontrado" (que fica reservado pro caso real de 404, se distinguível — se a API não distinguir 404 de erro genérico na resposta, documentar essa limitação no relatório e ao menos trocar a mensagem genérica por algo que não afirme categoricamente "não encontrado" quando pode ser só uma falha transitória).
- [ ] type-check/lint/build verdes. Commit: `fix(web): erro de rede em Contratos nao aparenta 404`.

### Task 6: Validação visual + entrega

- [ ] Estender o script BFF-mock (padrão da sessão) pra simular `route.fulfill({status: 500})` nos endpoints de cada tela tocada (summary, series, usage/series, costs/summary, contract kpis, contract detail) e capturar screenshot de CADA tela em estado de erro — confirmar visualmente que aparece mensagem de erro (não zero, não vazio enganoso). Depois, capturar as mesmas telas com dados normais pra confirmar que nada quebrou no caminho feliz.
- [ ] Suite API completa + web type-check/lint/build de novo no fim.
- [ ] Review final whole-branch (controller despacha, foco: a trava de invariante não bloqueia fluxos legítimos existentes — rodar a suite completa de receivables cobre isso; o padrão de erro é consistente entre as 5 telas tocadas).
- [ ] Merge na main + push. Deploy só se o Rick pedir (sem migração desta vez — API sobe pelo Render automaticamente no push; web fica pendente de `vercel --prod` explícito).
