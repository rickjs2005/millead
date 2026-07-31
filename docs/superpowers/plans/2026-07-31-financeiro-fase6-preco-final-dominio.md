# Módulo Financeiro — Fase 6: Preço final + Domínio por anos + Unificação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O sistema sugere, o Rick decide: campo "Preço final" editável no orçamento (conversão direta, sem dialog de escolha); seletor de domínio 1/2/3 anos como custo à vista com linha própria no PDF; proposta SÓ nasce de orçamento (dialog manual removido das entradas).

**Architecture:** Decisões do Rick em 31/07 (4 respostas aprovadas). Fases 1-5 na main (`a2804aa`). Mesmos padrões.

## Global Constraints

- Mesmas das fases anteriores. Migration aditiva (3 colunas em `pricing_estimates`, sem tabela nova → sem RLS novo).
- `computeEstimate` muda de novo (domínio) → API e espelho client **byte-idênticos no mesmo commit**, tipos web juntos.
- Domínio: preço/ano vem do catálogo `registrobr-domain` NO MOMENTO da edição e fica **snapshotado** no orçamento (`domainYearPriceBrl`) — catálogo mudar não muda orçamento salvo.
- PDF: linha "Registro de domínio (N anos)" própria; "Desenvolvimento e implantação" = finalPrice − infra×meses − domínio; se qualquer subtração ≤ 0, cai pra linha única com o total (guard existente estendido).
- `CreateProposalDialog` continua EXISTINDO como componente (outros usos), mas as entradas principais passam a apontar pro orçamento.

## Verificações de ambiente

- `git checkout main && git checkout -b feat/finance-final-price`; conferir HEAD ≥ `a2804aa`.

---

### Task 1: DB — finalPrice + domínio no orçamento

**Files:** `packages/database/prisma/schema.prisma`, migration `add_estimate_final_price_domain`.

- [ ] Em `PricingEstimate`: `finalPrice Decimal? @db.Decimal(12, 2) @map("final_price")`, `domainYears Int? @map("domain_years")`, `domainYearPriceBrl Decimal? @db.Decimal(12, 2) @map("domain_year_price_brl")`.
- [ ] Migration `--create-only` → conferir 3 ADD COLUMN → aplicar → generate → type-check.
- [ ] Commit `feat(db): preço final e domínio por anos no orçamento`.

---

### Task 2: API — cálculo do domínio, preço final e conversão direta

**Files:** `estimate.dto.ts` (+testes), `estimate-calc.ts` API+espelho (+testes), `domain/entities/estimate.ts`, `prisma-estimate-repository.ts`, `estimate-service.ts` (+testes), `infrastructure/proposals/pdf/render.ts` (+testes), `types/api.ts` (espelho no mesmo commit).

- [ ] DTO create (e via partial, update): `finalPrice` opcional nullable (money.min(1) quando presente), `domainYears z.number().int().min(1).max(3).optional().nullable()`, `domainYearPriceBrl` money opcional nullable. Refine: `domainYears` presente exige `domainYearPriceBrl` presente (e vice-versa é livre).
- [ ] `computeEstimate`: input ganha `domainYears: number | null` e `domainYearPriceBrl: number` (0 quando sem domínio); retorno ganha `domainCost = (domainYears ?? 0) × domainYearPriceBrl`; `totalCost += domainCost` (domínio NÃO entra em infraCost nem oneTimeCost — campo próprio). Testes: 2 anos × 40 = 80 no total; null → 0. Espelho client idêntico. Tipos web (`EstimateComputed.domainCost`, campos novos em `PricingEstimate`/`EstimatePayload`).
- [ ] Entities/repo: campos novos com Decimal→string, persistência no create/update (padrão dos demais).
- [ ] `convert`: `price` no body vira OPCIONAL → default `Number(estimate.finalPrice)` quando salvo, senão `computed.priceRecommended`. `ProposalPdfData` ganha `domainYears: number | null` e `domainCostBrl: number`; renderer: linha "Registro de domínio ({N} {ano|anos})" quando domainCostBrl > 0; "Desenvolvimento e implantação" = finalPrice − infra×meses − domainCostBrl (guard ≤0 → linha única). Testes: PDF com domínio tem a linha; convert sem body usa finalPrice salvo; sem finalPrice usa recommended.
- [ ] Suíte + type-check/lint dos 2 pacotes. Commit `feat(api): preço final decidido pelo dono, domínio por anos e conversão direta`.

---

### Task 3: Web — painel com preço final, seletor de domínio, unificação

**Files:** `estimate-editor.tsx`, `estimate-result-panel.tsx`, `convert-estimate-dialog.tsx` (simplificar), `app/(app)/estimates/new/page.tsx` (prefill leadId), `app/(app)/proposals/page.tsx`, `features/leads` (onde o quick-create de proposta é oferecido — conferir `lead-crm-tab`/detalhe do lead), `services/estimates.ts`, `hooks.ts`.

- [ ] **Preço final no painel**: abaixo de mínimo/recomendado/premium, campo "Preço final (você decide)" editável (vírgula ok), com 3 botões pequenos [Mínimo] [Recomendado] [Premium] que preenchem o campo. Novo orçamento: pré-preenche com recomendado ao 1º cálculo (só se o campo ainda não foi tocado). Persiste no save (`finalPrice`).
- [ ] **Domínio**: no bloco de infra, controle "Domínio .br (Registro.br)": select Nenhum / 1 ano — R$ 40 / 2 anos — R$ 80 / 3 anos — R$ 120 (preço/ano lido do catálogo `registrobr-domain` via `useCostCatalog`, com fallback 40; snapshot `domainYearPriceBrl` gravado ao salvar). Painel: linha "Domínio ({N} anos)" quando > 0.
- [ ] **Conversão direta**: "Gerar proposta" abre APENAS um `ConfirmDialog` mostrando o preço final (ou recomendado se não preenchido) e o aviso do PDF; confirma → `convert(id)` SEM body de price (API resolve). O `convert-estimate-dialog.tsx` com radios morre (deletar) — a lógica de sucesso (abrir PDF, invalidar) vai pro editor/hook.
- [ ] **Unificação**: página Propostas: botão "Nova proposta" vira `Link` "Novo orçamento" → `/estimates/new`. No detalhe do lead (quick actions), a criação de proposta passa a linkar `/estimates/new?leadId={id}`; `new/page.tsx` lê `useSearchParams` e pré-seleciona o lead. `CreateProposalDialog` deixa de ser usado nesses 2 pontos (não deletar o arquivo se houver outros usos — conferir grep; se zero usos restantes, deletar).
- [ ] Lint/type-check; dev compila. Commit `feat(web): preço final do dono, domínio por anos e proposta só via orçamento`.

---

### Task 4: Suíte + review final + checkpoint (controlador)

- [ ] CI completo + vitest; review final; checkpoint com o Rick.

## Self-review do plano

- Cobre as 4 decisões: unificação (entradas → orçamento) ✓, preço final sugerido+editável com conversão direta ✓, domínio 1/2/3 anos à vista com linha no PDF ✓, contas por cliente já cobertas pela infra mensal existente ✓.
- Consistência: `domainCost` separado de oneTimeCost/infra nos DOIS lados do cálculo; snapshot do preço/ano; convert sem body → finalPrice → recommended.
