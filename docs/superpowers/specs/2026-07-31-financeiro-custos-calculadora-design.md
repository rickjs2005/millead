# Módulo Financeiro — Centro de Custos + Calculadora de Precificação

**Data:** 2026-07-31
**Status:** Aprovado (decisões de escopo confirmadas pelo Rick em 31/07/2026)
**Origem:** Conversa Rick ↔ ChatGPT ("Calculadora para Millead") + prejuízo real no projeto Kavita Drones (custo recorrente da Vercel assumido sem estar na proposta).

## Problema

Hoje a MilWeb precifica projetos por intuição. Não há registro de quanto custa manter a operação (Claude + Higgsfield ≈ R$ 800/mês), quanto cada cliente gera de custo recorrente (Vercel, Supabase, Render, domínio), nem quanto da infraestrutura contratada já está ocupada. Resultado: propostas subprecificadas e sustos como o da Kavita Drones.

## Decisões aprovadas

1. **Escopo:** módulo completo, construído em 4 fases (Custos → Calculadora → Proposta/PDF → Capacidade + dashboard), cada fase entra no ar antes da próxima.
2. **Proposta:** o orçamento integra com o módulo Propostas existente — botão "Gerar proposta" cria uma `Proposal` e gera o PDF dela (campo `pdfUrl` hoje existe mas nada o gera).
3. **Moeda:** custos em USD cadastrados na moeda original + câmbio configurável por organização (ex.: 5,30 já com margem de IOF/spread). Câmbio de referência em 31/07/2026: US$ 1 ≈ R$ 5,07.
4. **Permissões:** reusa `proposals:read`/`proposals:write` (mesmo atalho de Contratos e Briefings — zero re-seed).

## Dados reais levantados (jul/2026)

| Serviço | Plano | Preço de tabela | Observações |
|---|---|---:|---|
| Vercel | Hobby | US$ 0 | limites: 100 GB banda, 1M invocações; sem uso comercial |
| Vercel | Pro | US$ 20/mês | + US$ 20 de crédito de uso incluso; banda 1 TB |
| Supabase | Free | US$ 0 | 2 projetos, pausa após 1 semana inativo, 500 MB banco |
| Supabase | Pro | US$ 25/mês | 8 GB banco, 100 GB storage; compute Micro US$ 10/projeto (1 crédito incluso) |
| Render | Web Starter | US$ 7/mês | 512 MB RAM; free tier = 750 h/mês com spin-down |
| Render | Postgres Basic-256mb | US$ 6/mês | Postgres free expira em 30 dias |
| Claude | Pro | US$ 20/mês | inclui Claude Code |
| Claude | **Max 5x — plano do Rick** | US$ 100/mês | **Rick paga ≈ R$ 550/mês (valor real declarado, seed usa este)** |
| Higgsfield | **plano mais barato — plano do Rick** | — | **Rick paga ≈ R$ 239/mês (valor real declarado, seed usa este)** |
| Higgsfield | Ultra | US$ 99/mês (anual) | referência de catálogo |
| Cloudflare Pages | Free | R$ 0 | destino padrão de landing pages estáticas |
| Registro.br | domínio .br | R$ 40/ano | pago pelo cliente em geral |
| GitHub | Free | R$ 0 | |

## Arquitetura

Segue o padrão canônico do monorepo: Prisma models org-scoped → API (dto → repo interface → prisma repo → service → controller → routes → `container.ts` → `app.ts`) → front por feature (`services/` → `lib/query-keys.ts` → `features/finance/` → `app/(app)/…` → `nav-items.ts` → `types/api.ts`). Molde de referência: módulo de Briefings (inclusive o padrão template global do seed vs. item custom da org).

### Modelos novos (packages/database/prisma/schema.prisma)

Convenções obrigatórias: `id String @id @default(cuid())`, `organizationId` em toda tabela, `@map`/`@@map` snake_case, dinheiro `Decimal @db.Decimal(12,2)`, percentual `Decimal(5,2)`, migration com `ALTER TABLE … ENABLE ROW LEVEL SECURITY;` em cada tabela nova.

**`CostSubscription`** — uma assinatura/custo real que a organização paga.

- `organizationId`, `name` ("Higgsfield Ultra"), `serviceKey String?` (liga ao catálogo seedado: `vercel-pro`, `supabase-pro`…)
- `scope` enum `AGENCY | CLIENT` — agência = pago independentemente de clientes (entra no rateio); cliente = existe por causa de um projeto específico
- `companyId String?` — quando `scope=CLIENT`, aponta o cliente dono do custo
- `amount Decimal(12,2)`, `currency` enum `BRL | USD`, `billingCycle` enum `MONTHLY | YEARLY`
- `capacityLimit Int?`, `capacityUsed Int?` — capacidade recomendada e uso atual (ex.: Vercel Pro limite 30, usados 18). Manuais no v1
- `isActive Boolean`, `notes String?`, timestamps
- Índices: `@@index([organizationId, scope])`, `@@index([organizationId, isActive])`

**`CostServiceCatalog`** — catálogo de serviços conhecidos (padrão BriefingTemplate: `organizationId String?` — `NULL` = global do seed, preenchido = custom da org).

- `key @unique` (`vercel-pro`), `name`, `category` enum `HOSTING | DATABASE | AI | DOMAIN | EMAIL | SIGNATURE | OTHER`
- `defaultAmount Decimal(12,2)`, `currency`, `billingCycle`, `defaultScope`
- `defaultCapacityLimit Int?`, `bestFor String?` ("Melhor para Next.js com SSR"), `billingNotes String?` ("cobra por uso + recursos")
- Seed com a tabela de dados reais acima.

**`FinanceSettings`** — 1 linha por organização.

- `usdToBrlRate Decimal(8,4)` (default 5.30), `defaultHourlyRate Decimal(12,2)` (default 120)
- `supportReservePct Decimal(5,2)` (default 10), `defaultMarginPct Decimal(5,2)` (default 30)
- `activeClientsCount Int` (default 1) — divisor do rateio; manual no v1, a UI mostra como sugestão o nº de leads `WON`

**`ProjectProduct`** — catálogo de produtos vendáveis com faixas de preço (org-scoped, seedado).

- `name`, `priceMin/priceMax Decimal(12,2)`, `baseHours Int?`, `description String?`, `order Int`, `isActive`
- Seed: Landing Page Essencial R$ 2.000–3.500 · Landing Page Premium R$ 3.500–6.000 · Site Institucional R$ 5.000–8.000 · Institucional Premium R$ 8.000–15.000 · Sistema Web / SaaS R$ 15.000+

**`PricingEstimate`** — o orçamento em si.

- `organizationId`, `leadId String?`, `createdById`, `title`, `status` enum `DRAFT | READY | CONVERTED`
- `productId String?`, `hourlyRate Decimal(12,2)`, `hoursBreakdown Json` (`[{ label: "Design", hours: 7 }, …]`)
- `agencyShareMonthly Decimal(12,2)` — snapshot do rateio no momento (editável)
- `infraMonths Int` (default 12), `supportReservePct`, `marginPct Decimal(5,2)`
- `scopeItems Json` (`string[]` — bullets do escopo que vão pro PDF), `deadlineDays Int` (default 30 — prazo prometido no PDF), `paymentTerms String` (default "50% para iniciar, 50% na entrega"), `validDays Int` (default 15)
- `proposalId String?` — preenchido na conversão
- Filho **`PricingEstimateCost`**: `estimateId`, `label`, `amount Decimal(12,2)`, `currency`, `billingCycle`, `subscriptionId String?` — snapshot dos custos de infra selecionados (não referencia valor vivo; orçamento antigo não muda quando o custo muda)

### Cálculo (fonte da verdade no service da API; espelhado no front só para preview ao vivo)

```
devCost        = Σ(hoursBreakdown.hours) × hourlyRate
infraMonthly   = Σ(custo normalizado mensal em BRL)      // YEARLY ÷ 12; USD × usdToBrlRate
infraCost      = infraMonthly × infraMonths + agencyShareMonthly × infraMonths
supportReserve = devCost × supportReservePct
totalCost      = devCost + infraCost + supportReserve    // custo real, nunca aceitar abaixo
priceMin       = totalCost
priceRecommended = totalCost × (1 + marginPct)
pricePremium   = totalCost × (1 + marginPct + 0.15)
```

Rateio exibido no Centro de Custos: `Σ(custos AGENCY ativos, normalizados mensais em BRL) ÷ activeClientsCount`.

Valores trafegam como **string** na API (padrão `Proposal.value` existente); cálculo no backend com `Prisma.Decimal`, no front com números JS (é só preview).

### API

Duas montagens novas em `app.ts`, ambas com `authenticate` + `requirePermission("proposals:read"|"proposals:write")`:

- `/api/v1/costs` — CRUD `CostSubscription` · `GET /catalog` (catálogo, cache TTL 5 min, padrão `cached-briefing-template-repository`) · `GET/PATCH /settings` (FinanceSettings, upsert) · `GET /summary` (totais: fixo mensal, por cliente, rateio, utilização por serviço — alimenta dashboard e a calculadora)
- `/api/v1/estimates` — CRUD `PricingEstimate` (+ itens aninhados no create/update, padrão `createCustom` de briefings) · `GET /products` e CRUD de `ProjectProduct` · `POST /:id/convert` → cria `Proposal` (title, `value` = preço escolhido, leadId obrigatório neste ponto, status DRAFT), gera o PDF, sobe pro **Vercel Blob** (`BLOB_READ_WRITE_TOKEN` já é obrigatório na API), seta `proposalId` + `pdfUrl`, grava `Activity`; estimate vira `CONVERTED`

### PDF da proposta (cliente)

`infrastructure/proposals/pdf/render.ts` apoiado em `infrastructure/pdf/layout.ts` (mesma identidade dos PDFs de contrato). Geração **síncrona** no endpoint de conversão (pdf-lib é rápido; sem worker novo). Conteúdo: capa (logo, cliente, data, nº) → resumo (projeto, prazo = `deadlineDays`, investimento) → escopo (`scopeItems`) → investimento (valor final; infra do cliente destacada como linha própria quando houver) → condições (pagamento, validade). **Nunca imprime custos internos, rateio ou margem** — a visão interna é a tela da calculadora.

### Frontend

Seção nova **"Financeiro"** em `nav-items.ts` (permission `proposals:read`):

- **`/costs` — Centro de Custos**: cards de resumo (custo fixo mensal, custo por cliente, rateio por cliente ativo) → tabela de assinaturas (badge AGENCY/CLIENT, valor original + convertido, ciclo) com dialog RHF+Zod de criar/editar (pré-preenchido ao escolher item do catálogo) → seção capacidade (barra `Progress` por serviço com limite/uso editáveis, alerta visual ≥ 80%) → dialog de configurações (câmbio, valor/hora, reserva, margem, clientes ativos com sugestão de leads WON).
- **`/estimates` — Orçamentos**: lista (padrão `proposals/page.tsx`) → `/estimates/new` e `/estimates/[id]`: formulário em colunas (produto → horas por etapa → infra do cliente via checkboxes do catálogo/assinaturas → margem) com painel lateral fixo de resultado ao vivo (custo real / mínimo / recomendado / premium, faixa do produto como referência) → botões "Salvar" e "Gerar proposta".
- **Dashboard**: 2 `stat-card` novos via `GET /costs/summary` (custo fixo mensal, custo médio por cliente) + alerta de capacidade quando algum serviço ≥ 80%.

### Fases de entrega

1. **Fase 1 — Centro de Custos**: migrations (RLS!), seed do catálogo + produtos + custos reais do Rick (**Claude Max 5x R$ 550/mês** e **Higgsfield R$ 239/mês** como AGENCY ativos; Vercel Hobby, Supabase Free e Render Free como R$ 0 para rastreio de capacidade; domínios Registro.br R$ 40/ano), API `/costs`, página `/costs`, nav.

**Editabilidade total das assinaturas (requisito explícito do Rick):** toda assinatura — inclusive as do seed — é um registro comum da org, com editar preço (subiu/baixou), ativar/desativar (`isActive` com switch na tabela) e adicionar/remover novas a qualquer momento. O seed só cria o ponto de partida; nada é fixo no código.
2. **Fase 2 — Calculadora**: API `/estimates` + produtos, páginas de orçamento com preview ao vivo.
3. **Fase 3 — Proposta + PDF**: renderer, `POST /:id/convert`, integração com a página de Propostas.
4. **Fase 4 — Capacidade + Dashboard**: campos de capacidade na UI, alertas, cards no dashboard.

Cada fase: migration aplicada em produção (`pnpm db:migrate:deploy` manual, padrão atual), deploy API (Render auto via push) + web (Vercel), verificação no ar em `millead.milweb.com.br`.

### Fora de escopo (YAGNI, anotado para o futuro)

- Consulta automática às APIs de billing/usage da Vercel/Supabase/Render (contadores são manuais no v1; a conta Vercel conectada ao MCP só enxerga 1 projeto, então automação exigiria tokens por conta).
- PDF interno com custos (a tela da calculadora cumpre esse papel).
- Dashboard financeiro completo (receita × despesa × lucro) — depende de registrar receitas, que hoje não existem como entidade.
- Alerta automático "novo projeto levará Vercel a 92%" no fluxo de criação de lead (v1 mostra utilização no Centro de Custos e no dashboard).

### Testes

Vitest na API (padrão existente): unidade do cálculo de preço (casos: horas zero, custo anual, USD→BRL, margem custom), regras de conversão estimate→proposal (leadId obrigatório, snapshot imutável), e visibilidade org-scoped do catálogo custom.
