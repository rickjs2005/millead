# Módulo Financeiro — Fase 2: Calculadora de Orçamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calculadora de precificação na MilLead: orçamentos (`PricingEstimate`) com horas por etapa, infra do cliente snapshotada, rateio da agência, reserva e margem → custo real + preço mínimo/recomendado/premium, com páginas `/estimates`.

**Architecture:** Mesmo padrão da Fase 1 (spec: `docs/superpowers/specs/2026-07-31-financeiro-custos-calculadora-design.md`, seções "PricingEstimate", "Cálculo", "API /estimates", "Frontend /estimates"). A Fase 1 (commits até `28604b4`) entregou: models de custos, `CostService` (exporta `monthlyAmountBrl`), rotas `/api/v1/costs` com `GET /summary` (rateio `perClientShareBrl`), hooks web `features/finance/*`. A Fase 2 constrói o recurso `estimates` em cima disso.

**Tech Stack:** idêntico à Fase 1 (Prisma 6, Express 4 + Zod, vitest, Next 15, TanStack Query 5, RHF+zodResolver, shadcn-style).

## Global Constraints

- Mesmas da Fase 1: colunas `@map("snake_case")`, tabelas `@@map("plural_snake")`, enums com `@@map("snake_case")` (lição da Fase 1!), dinheiro `Decimal(12,2)`, percentual `Decimal(5,2)`, migration termina com `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` por tabela nova, imports API com sufixo `.js`, `organizationId` sempre de `req.auth`, permissões `PERMISSIONS.PROPOSALS_READ/WRITE`, decimais como string no wire, UI pt-BR.
- **Snapshot imutável**: `PricingEstimateCost` guarda label/amount/currency/cycle copiados no momento da edição — nunca referencia valor vivo de `CostSubscription` (só guarda `subscriptionId` como origem). Orçamento antigo não muda quando o custo muda.
- **Cálculo: fonte da verdade no service da API** (função pura exportada + testes). O front espelha a mesma fórmula apenas para preview ao vivo.
- Fórmula exata (spec):
  - `devCost = Σ(hours) × hourlyRate`
  - `infraMonthlyBrl = Σ(monthlyAmountBrl(item.amount, item.currency, item.billingCycle, usdRate))`
  - `infraCost = (infraMonthlyBrl + agencyShareMonthly) × infraMonths`
  - `supportReserve = devCost × supportReservePct/100`
  - `totalCost = devCost + infraCost + supportReserve`
  - `priceMin = totalCost`; `priceRecommended = totalCost × (1 + marginPct/100)`; `pricePremium = totalCost × (1 + marginPct/100 + 0.15)`
  - `usdRate` = `FinanceSettings.usdToBrlRate` atual da org no momento da leitura (o snapshot congela amount/moeda, não o câmbio).
- Totais NÃO são persistidos — computados a cada leitura e devolvidos num bloco `computed` da resposta.
- Conversão em Proposal/PDF é **Fase 3** — nesta fase `proposalId` existe no schema mas nada o preenche.

## Verificações de ambiente (antes do Task 1)

- Branch: `git checkout main && git checkout -b feat/finance-calculator`. (A Fase 1 já está mergeada na main local; se `git log --oneline -1` não mostrar `28604b4` ou mais novo, PARE e avise o controlador.)
- `.env` com `DATABASE_URL` (migrations rodam contra o Supabase real — só mudanças aditivas).

---

### Task 1: Models `PricingEstimate` + `PricingEstimateCost` + migration RLS

**Files:**

- Modify: `packages/database/prisma/schema.prisma`
- Create: migration `add_pricing_estimates` (gerada com `--create-only`, editada com RLS, aplicada)

**Interfaces:**

- Produces: `prisma.pricingEstimate`, `prisma.pricingEstimateCost`; enum `EstimateStatus { DRAFT READY CONVERTED }` com `@@map("estimate_status")`.

- [ ] **Step 1: Append ao schema** (relações inversas: `Organization.pricingEstimates`, `Lead.pricingEstimates`, `User.pricingEstimates`, `ProjectProduct.pricingEstimates`, `Proposal.pricingEstimate PricingEstimate?`):

```prisma
enum EstimateStatus {
  DRAFT
  READY
  CONVERTED

  @@map("estimate_status")
}

model PricingEstimate {
  id                 String         @id @default(cuid())
  organizationId     String         @map("organization_id")
  leadId             String?        @map("lead_id")
  createdById        String         @map("created_by_id")
  productId          String?        @map("product_id")
  proposalId         String?        @unique @map("proposal_id")
  title              String
  status             EstimateStatus @default(DRAFT)
  hourlyRate         Decimal        @db.Decimal(12, 2) @map("hourly_rate")
  hoursBreakdown     Json           @default("[]") @map("hours_breakdown")
  agencyShareMonthly Decimal        @db.Decimal(12, 2) @default(0) @map("agency_share_monthly")
  infraMonths        Int            @default(12) @map("infra_months")
  supportReservePct  Decimal        @db.Decimal(5, 2) @default(10) @map("support_reserve_pct")
  marginPct          Decimal        @db.Decimal(5, 2) @default(30) @map("margin_pct")
  scopeItems         Json           @default("[]") @map("scope_items")
  deadlineDays       Int            @default(30) @map("deadline_days")
  paymentTerms       String         @default("50% para iniciar, 50% na entrega") @map("payment_terms")
  validDays          Int            @default(15) @map("valid_days")
  createdAt          DateTime       @default(now()) @map("created_at")
  updatedAt          DateTime       @updatedAt @map("updated_at")

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  lead         Lead?           @relation(fields: [leadId], references: [id], onDelete: SetNull)
  createdBy    User            @relation(fields: [createdById], references: [id], onDelete: Restrict)
  product      ProjectProduct? @relation(fields: [productId], references: [id], onDelete: SetNull)
  proposal     Proposal?       @relation(fields: [proposalId], references: [id], onDelete: SetNull)
  costItems    PricingEstimateCost[]

  @@index([organizationId, status])
  @@index([organizationId, leadId])
  @@map("pricing_estimates")
}

model PricingEstimateCost {
  id             String           @id @default(cuid())
  organizationId String           @map("organization_id")
  estimateId     String           @map("estimate_id")
  subscriptionId String?          @map("subscription_id")
  label          String
  amount         Decimal          @db.Decimal(12, 2)
  currency       CostCurrency     @default(BRL)
  billingCycle   CostBillingCycle @default(MONTHLY) @map("billing_cycle")

  organization Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  estimate     PricingEstimate   @relation(fields: [estimateId], references: [id], onDelete: Cascade)
  subscription CostSubscription? @relation(fields: [subscriptionId], references: [id], onDelete: SetNull)

  @@index([organizationId, estimateId])
  @@map("pricing_estimate_costs")
}
```

(Adicionar também `pricingEstimateCosts PricingEstimateCost[]` em `Organization` e `CostSubscription`.)

- [ ] **Step 2:** `--create-only`, append RLS (`pricing_estimates`, `pricing_estimate_costs`), `pnpm db:migrate`, `pnpm db:generate`. Se pedir reset/drift: BLOCKED.
- [ ] **Step 3:** `pnpm turbo type-check --filter=@millead/database --filter=@millead/api` → PASS.
- [ ] **Step 4:** Commit `feat(db): modelos de orçamento (PricingEstimate) com RLS`.

---

### Task 2: Cálculo puro + testes (TDD) e ProductService

**Files:**

- Create: `apps/api/src/application/services/estimate-calc.ts`
- Create: `apps/api/src/application/services/estimate-calc.test.ts`

**Interfaces:**

- Consumes: `monthlyAmountBrl` exportado de `./cost-service.js` (Fase 1).
- Produces (Task 3/4 consomem):

```ts
export interface EstimateCalcInput {
  hourlyRate: number;
  hoursBreakdown: { label: string; hours: number }[];
  costItems: { amount: number; currency: "BRL" | "USD"; billingCycle: "MONTHLY" | "YEARLY" }[];
  agencyShareMonthly: number;
  infraMonths: number;
  supportReservePct: number;
  marginPct: number;
  usdToBrlRate: number;
}
export interface EstimateComputed {
  totalHours: number;
  devCost: number;
  infraMonthlyBrl: number;
  infraCost: number;
  supportReserve: number;
  totalCost: number;
  priceMin: number;
  priceRecommended: number;
  pricePremium: number;
}
export function computeEstimate(input: EstimateCalcInput): EstimateComputed;
```

- [ ] **Step 1: Teste primeiro** — `estimate-calc.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeEstimate } from "./estimate-calc.js";

const BASE = {
  hourlyRate: 120,
  hoursBreakdown: [
    { label: "Design", hours: 10 },
    { label: "Frontend", hours: 25 },
    { label: "Testes", hours: 7 },
  ],
  costItems: [
    { amount: 20, currency: "USD", billingCycle: "MONTHLY" },
    { amount: 40, currency: "BRL", billingCycle: "YEARLY" },
  ],
  agencyShareMonthly: 80,
  infraMonths: 12,
  supportReservePct: 10,
  marginPct: 30,
  usdToBrlRate: 5,
} as const;

describe("computeEstimate", () => {
  it("caso da spec: horas, infra snapshotada, rateio, reserva e margem", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [...BASE.costItems],
    });
    expect(r.totalHours).toBe(42);
    expect(r.devCost).toBe(42 * 120); // 5040
    expect(r.infraMonthlyBrl).toBeCloseTo(100 + 40 / 12, 2); // 103.33
    expect(r.infraCost).toBeCloseTo((103.333333 + 80) * 12, 1); // 2200
    expect(r.supportReserve).toBeCloseTo(504, 2);
    expect(r.totalCost).toBeCloseTo(5040 + 2200 + 504, 1); // 7744
    expect(r.priceMin).toBeCloseTo(r.totalCost, 5);
    expect(r.priceRecommended).toBeCloseTo(r.totalCost * 1.3, 1);
    expect(r.pricePremium).toBeCloseTo(r.totalCost * 1.45, 1);
  });

  it("orçamento vazio não explode", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [],
      costItems: [],
      agencyShareMonthly: 0,
      supportReservePct: 0,
      marginPct: 0,
    });
    expect(r.devCost).toBe(0);
    expect(r.totalCost).toBe(0);
    expect(r.priceRecommended).toBe(0);
  });

  it("infraMonths zero anula infra (projeto sem hospedagem contratada)", () => {
    const r = computeEstimate({
      ...BASE,
      hoursBreakdown: [...BASE.hoursBreakdown],
      costItems: [...BASE.costItems],
      infraMonths: 0,
    });
    expect(r.infraCost).toBe(0);
    expect(r.totalCost).toBeCloseTo(5040 + 504, 1);
  });
});
```

- [ ] **Step 2:** rodar → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `estimate-calc.ts` (usa `monthlyAmountBrl` importado de `./cost-service.js`; aritmética em number JS como na Fase 1).
- [ ] **Step 4:** rodar → PASS. Suíte inteira da API segue verde.
- [ ] **Step 5:** Commit `feat(api): cálculo puro do orçamento (computeEstimate) com testes`.

---

### Task 3: API — DTOs, entidades, repositório (estimates + products)

**Files:**

- Create: `apps/api/src/domain/entities/estimate.ts` (interfaces à mão, Decimal como **string**, padrão Fase 1 `cost.ts`; incluir `EstimateCostItem` e `ProjectProduct`)
- Create: `apps/api/src/domain/repositories/estimate-repository.ts`
- Create: `apps/api/src/application/dto/estimate.dto.ts`
- Create: `apps/api/src/infrastructure/prisma/prisma-estimate-repository.ts`

**Interfaces:**

- Produces: `EstimateRepository`:

```ts
export interface EstimateRepository {
  list(
    organizationId: string,
    params: { status?: EstimateStatus; page: number; pageSize: number },
  ): Promise<{ items: PricingEstimateWithItems[]; total: number }>;
  findById(organizationId: string, id: string): Promise<PricingEstimateWithItems | null>;
  create(
    organizationId: string,
    createdById: string,
    data: CreateEstimateInput,
  ): Promise<PricingEstimateWithItems>;
  update(
    organizationId: string,
    id: string,
    data: UpdateEstimateInput,
  ): Promise<PricingEstimateWithItems | null>;
  delete(organizationId: string, id: string): Promise<boolean>;
  listProducts(organizationId: string): Promise<ProjectProduct[]>;
}
```

- DTO Zod (`estimate.dto.ts`): `hoursLineSchema {label 1..40, hours number 0..10000}`, `costItemSchema {label 1..80, amount 0..9_999_999, currency, billingCycle, subscriptionId string.min(1).optional().nullable()}`, `createEstimateSchema {title 2..80, leadId?, productId?, hourlyRate 0..9_999_999, hoursBreakdown array max 20, costItems array max 30, agencyShareMonthly 0..9_999_999, infraMonths int 0..60, supportReservePct 0..100, marginPct 0..500, scopeItems array de string max 30 (cada 1..120), deadlineDays int 1..365, paymentTerms 1..200, validDays int 1..90, status enum opcional}`, `updateEstimateSchema = createEstimateSchema.partial()`, `listEstimatesQuerySchema {status?, page default 1, pageSize default 20 max 100}` (conferir o padrão de query schema em `lead.dto.ts`/`proposal.dto.ts` e copiar coerções).
- Repo Prisma: create/update com `costItems` aninhados **em transação**: update = `update` do estimate + `deleteMany`+`createMany` dos items (snapshot substituído inteiro — simples e correto pro volume); sempre `include: { costItems: true }`; update/delete org-scoped via `updateMany`/checagem `findFirst` (padrão Fase 1); `listProducts` = `isActive`, `OR [{organizationId: null}, {organizationId}]`, orderBy `order`.
- `leadId`/`productId`/`subscriptionId` quando presentes: validação de ownership fica no **service** (Task 4), não no repo.

- [ ] Steps: entities → dto → interface → prisma repo (moldes da Fase 1: `cost.dto.ts`, `prisma-cost-repository.ts` com `Row`/`toDomain*`) → `pnpm turbo type-check lint --filter=@millead/api` → Commit `feat(api): DTOs, entidades e repositório de orçamentos`.

---

### Task 4: API — EstimateService + controller + rotas + testes

**Files:**

- Create: `apps/api/src/application/services/estimate-service.ts`
- Create: `apps/api/src/application/services/estimate-service.test.ts`
- Create: `apps/api/src/interfaces/http/controllers/estimate-controller.ts`
- Create: `apps/api/src/interfaces/http/routes/estimate-routes.ts`
- Modify: `apps/api/src/main/container.ts`, `apps/api/src/main/app.ts`

**Interfaces:**

- `EstimateService` (repo + `CostRepository` da Fase 1 + `LeadRepository` — conferir método de ownership de lead usado por `proposal-service.ts` e usar o mesmo):
  - `list(orgId, query)` → `{ items: (Estimate & { computed: EstimateComputed })[], total }`
  - `get(orgId, id)` → com `computed` (404 se não achou)
  - `create(orgId, userId, input)` — valida `leadId` da org (padrão proposal-service), `productId` visível (listProducts contém), `subscriptionId`s existentes na org (via `CostRepository.listSubscriptions`); se `agencyShareMonthly` não vier no input, preenche do `computeSummary` atual (repo de custos: `getSettings` + `listSubscriptions` + `countWonLeads` → `perClientShareBrl`, reusar `computeSummary` exportado); devolve com `computed`.
  - `update(orgId, id, input)` — mesmas validações; 404 se não achou; devolve com `computed`.
  - `delete(orgId, id)` — 404 pattern.
  - `listProducts(orgId)`.
  - `computed` interno: monta `EstimateCalcInput` convertendo strings→number e chama `computeEstimate` com `usdToBrlRate` do `getSettings`.
- Rotas `/api/v1/estimates`: `GET /products` (read) ANTES de `/:id`; `GET /` (read, com `validateQuery(listEstimatesQuerySchema)` — conferir middleware real de query em `lead-routes.ts`), `POST /` (write), `GET /:id` (read), `PATCH /:id` (write), `DELETE /:id` (write).
- Testes (TDD nos pontos de lógica): validação de lead de outra org rejeita sem gravar; `agencyShareMonthly` auto-preenchido quando ausente; `computed` presente na resposta de `get`; 404 de update/delete (fakes como no `cost-service.test.ts` da Fase 1).

- [ ] Steps: testes → FAIL → implementar service → PASS → controller/rotas/container/app → type-check + suíte completa + smoke 401 → Commit `feat(api): rotas /api/v1/estimates com cálculo e validações de ownership`.

---

### Task 5: Web — tipos, service, hooks

**Files:**

- Modify: `apps/web/src/types/api.ts`, `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/services/estimates.ts`
- Create: `apps/web/src/features/estimates/hooks.ts`, `apps/web/src/features/estimates/estimate-labels.ts`, `apps/web/src/features/estimates/estimate-calc.ts`

**Interfaces:**

- Tipos: `EstimateStatus`, `HoursLine {label; hours}`, `EstimateCostItem` (amount string na leitura), `PricingEstimate` (com `costItems`, `computed: EstimateComputed`), `EstimateComputed` (9 campos number, espelho da API), `ProjectProduct` (priceMin/priceMax string), payloads de escrita com numbers (`EstimatePayload`).
- `estimatesService`: list (com `params` querystring — conferir helper de querystring dos services existentes, ex. `proposalsService.list`), get, create, update, remove, products.
- `queryKeys.estimates`: `list(params)`, `detail(id)`, `products()`.
- Hooks: `useEstimates(params)`, `useEstimate(id)`, `useEstimateProducts`, `useCreateEstimate`, `useUpdateEstimate`, `useDeleteEstimate` (invalidação namespace `["estimates"]`, toasts padrão Fase 1).
- `estimate-calc.ts` (espelho client para preview ao vivo): reimplementar `computeEstimate` + `monthlyAmountBrl` em TS puro **com comentário apontando a fonte da verdade na API** (`apps/api/src/application/services/estimate-calc.ts`) — mesma assinatura `EstimateCalcInput → EstimateComputed`.
- Labels: `ESTIMATE_STATUS_LABELS {DRAFT: "Rascunho", READY: "Pronto", CONVERTED: "Convertido"}` + variantes de badge (padrão `*-labels.ts` existentes).

- [ ] Steps: tipos → service → keys → hooks → calc espelho → labels → type-check → Commit `feat(web): camada de dados dos orçamentos`.

---

### Task 6: Web — páginas /estimates (lista + editor com preview ao vivo)

**Files:**

- Create: `apps/web/src/app/(app)/estimates/page.tsx`
- Create: `apps/web/src/app/(app)/estimates/new/page.tsx`
- Create: `apps/web/src/app/(app)/estimates/[id]/page.tsx`
- Create: `apps/web/src/features/estimates/components/estimates-list.tsx`
- Create: `apps/web/src/features/estimates/components/estimate-editor.tsx`
- Create: `apps/web/src/features/estimates/components/estimate-result-panel.tsx`

**Interfaces:** consome hooks/labels/calc da Task 5, hooks da Fase 1 (`useCostSummary`, `useFinanceSettings`, `useCostSubscriptions`, `useCostCatalog`) e `useLeads`-equivalente existente (conferir hook real de leads pra um `<Select>` de lead opcional — `features/leads/hooks.ts`).

- [ ] **Step 1: `estimates-list.tsx` + `page.tsx`** — padrão proposals: filtro por status, tabela (Título, Lead, Produto, Preço recomendado (`computed.priceRecommended`), Status badge, atualizado em), linha clica → `/estimates/[id]`, botão "Novo orçamento" → `/estimates/new`, skeleton/erro/vazio com CTA.
- [ ] **Step 2: `estimate-editor.tsx`** — form RHF+zod (schema espelhando o DTO) usado por new e [id]:
  - Coluna esquerda: título; lead (Select opcional); produto (Select de `useEstimateProducts`, mostra faixa `priceMin–priceMax` do selecionado; escolher produto sugere `hoursBreakdown` vazio + preenche `hourlyRate` do settings se vazio); **horas por etapa** (linhas dinâmicas label+horas via `useFieldArray`, botão adicionar/remover, iniciar com Design/Frontend/Backend/SEO/Testes quando novo); **infra do cliente**: lista de checkboxes das assinaturas CLIENT + itens do catálogo (`useCostCatalog`) que ao marcar viram `costItems` snapshotados (label, amount, currency, cycle, subscriptionId quando origem de assinatura) + botão "item avulso" (linha manual); rateio da agência (number, pré-preenchido de `useCostSummary().perClientShareBrl` quando novo, editável, hint "R$ X calculado hoje"); meses de infra (default 12); reserva % ; margem (botões rápidos 20/30/40 + campo custom); escopo (textarea 1 item por linha ↔ `scopeItems`); prazo (dias), condições de pagamento, validade (dias).
  - Preview ao vivo: `watch()` do form → `computeEstimate` do espelho client com `usdToBrlRate` de `useFinanceSettings` → passa pro painel.
  - Salvar: create → redirect pra `/estimates/[id]`; update → toast (hooks já fazem).
- [ ] **Step 3: `estimate-result-panel.tsx`** — painel sticky à direita (grid `lg:grid-cols-[1fr_320px]`): custo de desenvolvimento (Nh × R$X), infra mensal + total do período, rateio no período, reserva, **Custo real** destacado, divisor, Preço mínimo / **Preço recomendado** (destaque primário) / Preço premium, e a faixa do produto selecionado como referência ("faixa do catálogo: R$ 2.000–3.500"). `formatCurrency` em tudo.
- [ ] **Step 4:** `[id]/page.tsx` carrega `useEstimate(id)` (skeleton/erro), passa `defaultValues`; `new/page.tsx` monta editor vazio com defaults do settings.
- [ ] **Step 5:** Verificação: `pnpm turbo lint type-check --filter=@millead/web`; dev server compila `/estimates`, `/estimates/new` (sem login — visual autenticado fica pro checkpoint).
- [ ] **Step 6:** Commit `feat(web): páginas de orçamento com calculadora e preview ao vivo`.

---

### Task 7: Nav + suíte completa + checkpoint

- [ ] **Step 1:** `nav-items.ts` — na seção "Financeiro": `{ label: "Orçamentos", href: "/estimates", icon: Calculator, permission: "proposals:read" }` (antes de Centro de Custos; import `Calculator` alfabético).
- [ ] **Step 2:** Suíte CI: `pnpm turbo lint type-check build` + `pnpm --filter @millead/api exec vitest run` (format:check tem falha CRLF local pré-existente conhecida — ignorar se for só isso).
- [ ] **Step 3:** Commit `feat(web): Orçamentos no menu Financeiro`.
- [ ] **Step 4 (controlador, NÃO subagente):** checkpoint com o Rick → merge/push/deploy só com OK explícito.

## Self-review do plano

- Cobertura da spec Fase 2: models estimate+cost ✓, cálculo com fórmula exata ✓, API CRUD + products + validações ownership ✓, snapshot imutável ✓, agencyShare auto do rateio ✓, páginas lista/editor/painel com faixas de produto e margem rápida ✓, nav ✓. Conversão→Proposal corretamente ausente (Fase 3).
- Sem placeholders: tarefas apontam moldes concretos da Fase 1 por caminho de arquivo; código exato onde a lógica é nova (schema, cálculo, testes, interfaces TS).
- Consistência: `EstimateComputed` idêntico API/web; `computeEstimate` mesma assinatura nos dois lados; nomes de hooks consumidos na Task 6 batem com a Task 5.
