# Auditoria financeira — correções críticas — design

Data: 2026-08-09 · Escopo aprovado pelo Rick: "Só o crítico agora" (dos 3 audits: backend/frontend financeiro + completude do dashboard)

## Contexto

Auditoria final pós-implementação dos 3 épicos financeiros recentes encontrou dois riscos reais (não estilo, não cobertura de teste — dado que pode ficar ERRADO na tela ou no banco):

1. **Integridade**: editar/excluir uma parcela de contrato não revalida o invariante `entrada + parcelas = contract.valorTotal` que `createPlan` garante na criação. Dá pra fazer o total divergir silenciosamente.
2. **Confiabilidade visual**: em ~10 pontos das telas financeiras, uma falha de rede (`isError`) não é distinguida de "não há dado" — a tela mostra R$ 0,00 / "0" como se fosse real. O componente `ErrorState` já existe e já é usado corretamente em alguns lugares (`finance-cards.tsx`, `revenue-cost-chart.tsx`); o padrão só não se propagou.

Fora de escopo desta rodada (documentado, não esquecido): robustez da cotação sob falha sustentada da API externa, auditoria de mutações com diff de valores, índice `[organizationId, paidAt]`, completude do dashboard (aguardandoAssinatura, N+1 do funil, MilSocial, etc.), e os achados Menores de formatação/duplicação.

## A) Integridade: revalidar o total do contrato

**Regra de negócio (decisão do controller, documentada pra reversão fácil):** para recebível **vinculado a contrato** (`contractId != null`), `update()` (mudança de `amount`) e `remove()` passam a **bloquear** a operação se o novo somatório de todos os recebíveis do contrato (excluindo pagos já baixados — ver nota) divergir de `contract.valorTotal` além de `SUM_TOLERANCE` (0.01), retornando erro `Conflict` com mensagem clara. Receita **avulsa** (`contractId == null`) não tem essa trava — não existe total de contrato pra bater.

- Nota de escopo: parcelas **pagas** (`paidAt != null`) não podem ser editadas em valor (`update()` já rejeita update de parcela paga com Conflict, comportamento existente — conferir e preservar). A checagem de soma, portanto, só precisa somar o estado hipotético pós-edição de todas as parcelas do contrato (pagas com seu valor histórico + as demais com o valor novo/removido).
- `remove()` de parcela **paga**: já deveria ser bloqueado (dinheiro já recebido não se apaga sem estorno) — CONFIRMAR comportamento atual antes de mexer; se já bloqueia, só a parcela ABERTA entra na nova checagem de soma.
- Mensagem de erro: algo como "Excluir/alterar esta parcela deixaria o total (R$ X) diferente do valor do contrato (R$ Y). Ajuste outra parcela junto ou edite o valor do contrato."

## B) Confiabilidade visual: erro nunca vira zero

Aplicar o padrão já estabelecido (`isError` → `ErrorState` ou variante inline compacta pra `StatCard`/card pequeno) nos pontos identificados:

1. `receivables/page.tsx` — 3 StatCards do topo (`summary.isError`) + os 2 StatCards do ano (`series.isError`, hoje só `summary`/`contracts` entram no `isError` da página).
2. `features/receivables/components/monthly-chart.tsx` — `useReceivablesSeries` sem isError (erro vira empty state enganoso).
3. `features/finance/components/usage-history-section.tsx` — mesmo padrão pro lado de custos.
4. `features/finance/components/cost-summary-cards.tsx` — 4 cards sem isError.
5. `features/finance/components/capacity-section.tsx` — mesmo hook, mesmo problema.
6. `features/dashboard/components/cost-summary-tiles.tsx` — usa o MESMO `useCostSummary` que `finance-cards.tsx` já trata corretamente na mesma página `/dashboard`; alinhar.
7. `features/dashboard/hooks.ts` (`useDashboardCounts`) — 12 queries sem isError exposto; os StatCards de contagem (leads/tarefas/reuniões/propostas/briefings) mostram "0" indistinguível de erro.
8. `app/(app)/contracts/page.tsx` — KPIs (`useContractKpis`) sem loading/isError; a fileira inteira some sem feedback.
9. `app/(app)/contracts/[id]/page.tsx` — erro de rede em `useContract(id)` cai no branch "Contrato não encontrado" (mensagem errada pra um problema transitório; sem retry).

Padrão de implementação: cada hook que hoje só desestrutura `data`/`isLoading` passa a desestruturar também `isError` e propagar pro componente decidir entre 3 estados (loading → skeleton, error → `ErrorState`/variante compacta, success → dado real). Para `StatCard` pequenos onde `ErrorState` completo não cabe visualmente, usar valor `null` (já suportado por `formatCurrency`/`StatCard` no episódio anterior — retorna "—") OU um ícone de alerta inline — critério do implementador, manter consistência com o que `finance-cards.tsx` já faz (referência canônica).

## Validação

- API: TDD no invariante (update que quebra soma → Conflict; update que mantém soma → ok; remove de parcela aberta que quebra soma → Conflict; avulsa nunca bloqueia). Suite completa.
- Web: type-check/lint/build. Validação visual: simular erro (rota do mock retornando 500) nas telas tocadas e CONFIRMAR que aparece erro, não zero — screenshot de cada uma.

## Entrega

Branch `auditoria-financeira-critica` → tasks com review → visual → review final → merge+push. Deploy (API Render auto no push; web CLI) só se o Rick pedir — como não há migração desta vez, a ordem de deploy não é crítica como no épico anterior.
