# Módulo Financeiro — Fase 1: Centro de Custos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centro de Custos na MilLead: assinaturas da agência/por cliente com valores reais do Rick, câmbio USD→BRL configurável, rateio por cliente ativo e página `/costs` completa.

**Architecture:** Segue o padrão canônico do monorepo (spec: `docs/superpowers/specs/2026-07-31-financeiro-custos-calculadora-design.md`). Prisma models org-scoped → API Express em camadas (dto → repo interface → prisma repo → service → controller → routes → container → app) → front Next por feature. Molde de código: módulo Tags (o mais compacto) + Briefings (catálogo global-vs-org).

**Tech Stack:** Prisma 6 (PostgreSQL/Supabase), Express 4 + Zod 3, vitest, Next 15 App Router, TanStack Query 5, react-hook-form + zodResolver, shadcn-style `components/ui`.

## Global Constraints

- **Toda tabela nova**: `organizationId` (exceto onde a spec diz nullable p/ seed global), colunas `@map("snake_case")`, tabela `@@map("plural_snake")`, `id String @id @default(cuid())`, dinheiro `Decimal @db.Decimal(12,2)`, percentual `Decimal(5,2)`.
- **Migration nova DEVE terminar com `ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;` para cada tabela criada** (Supabase expõe `public` via PostgREST — README.md:70-75).
- API é ESM com `tsx`: imports relativos **sempre com sufixo `.js`** (ex.: `from "../dto/cost.dto.js"`).
- Permissões: **reusar** `PERMISSIONS.PROPOSALS_READ` / `PROPOSALS_WRITE` (decisão aprovada — zero re-seed). Nunca criar permissão nova nesta fase.
- `organizationId` **nunca** vem do body — sempre de `req.auth` via `requireAuth(req)`.
- Valores monetários trafegam como **string** no JSON da API (Prisma Decimal serializa como string via `res.json`); no front, `formatCurrency` de `src/utils/format.ts`.
- UI em pt-BR, labels seguindo o tom das páginas existentes.
- Commits frequentes, mensagens `feat:`/`docs:`/`test:` como o histórico do repo.

## Verificações de ambiente (uma vez, antes do Task 1)

Rodar na raiz `C:\Users\rickj\projetos\millead`:

- `git status` deve estar limpo. Criar branch: `git checkout main && git checkout -b feat/finance-module`, depois trazer a spec: `git checkout feat/video-studio-inspector -- docs/superpowers/specs/2026-07-31-financeiro-custos-calculadora-design.md docs/superpowers/plans/2026-07-31-financeiro-fase1-centro-custos.md && git commit -m "docs: spec e plano do módulo Financeiro"`.
- `.env` na raiz precisa ter `DATABASE_URL` (session pooler Supabase, porta 5432) — migrations rodam com `dotenv -e ../../.env` via scripts `pnpm db:*`.

---

### Task 1: Modelos Prisma + migration com RLS

**Files:**

- Modify: `packages/database/prisma/schema.prisma` (append ao final)
- Create: `packages/database/prisma/migrations/<timestamp>_add_finance_module/migration.sql` (gerada + editada)

**Interfaces:**

- Produces: models `CostSubscription`, `CostServiceCatalog`, `FinanceSettings`, `ProjectProduct`; enums `CostScope`, `CostCurrency`, `CostBillingCycle`, `CostCategory`. Client em `@millead/database` (`prisma.costSubscription`, etc.).

- [ ] **Step 1: Append ao `schema.prisma`** (seguir convenções das tabelas vizinhas; `Organization` ganha as relações inversas — adicionar os campos de lista no model `Organization` existente: `costSubscriptions CostSubscription[]`, `costServiceCatalogItems CostServiceCatalog[]`, `financeSettings FinanceSettings?`, `projectProducts ProjectProduct[]`; e `Company` ganha `costSubscriptions CostSubscription[]`):

```prisma
// ---------------------------------------------------------------------------
// Módulo Financeiro (Fase 1) -- Centro de Custos.
// Catálogos usam o padrão BriefingTemplate: organizationId NULL = global do
// seed; preenchido = item custom da org (invisível pras demais).
// ---------------------------------------------------------------------------

enum CostScope {
  AGENCY
  CLIENT
}

enum CostCurrency {
  BRL
  USD
}

enum CostBillingCycle {
  MONTHLY
  YEARLY
}

enum CostCategory {
  HOSTING
  DATABASE
  AI
  DOMAIN
  EMAIL
  SIGNATURE
  OTHER
}

model CostSubscription {
  id             String           @id @default(cuid())
  organizationId String           @map("organization_id")
  companyId      String?          @map("company_id")
  serviceKey     String?          @map("service_key")
  name           String
  scope          CostScope
  amount         Decimal          @db.Decimal(12, 2)
  currency       CostCurrency     @default(BRL)
  billingCycle   CostBillingCycle @default(MONTHLY) @map("billing_cycle")
  capacityLimit  Int?             @map("capacity_limit")
  capacityUsed   Int?             @map("capacity_used")
  isActive       Boolean          @default(true) @map("is_active")
  notes          String?
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: SetNull)

  @@index([organizationId, scope])
  @@index([organizationId, isActive])
  @@map("cost_subscriptions")
}

model CostServiceCatalog {
  id                   String           @id @default(cuid())
  organizationId       String?          @map("organization_id")
  key                  String           @unique
  name                 String
  category             CostCategory
  defaultAmount        Decimal          @db.Decimal(12, 2) @map("default_amount")
  currency             CostCurrency     @default(USD)
  billingCycle         CostBillingCycle @default(MONTHLY) @map("billing_cycle")
  defaultScope         CostScope        @default(CLIENT) @map("default_scope")
  defaultCapacityLimit Int?             @map("default_capacity_limit")
  bestFor              String?          @map("best_for")
  billingNotes         String?          @map("billing_notes")
  isActive             Boolean          @default(true) @map("is_active")
  createdAt            DateTime         @default(now()) @map("created_at")
  updatedAt            DateTime         @updatedAt @map("updated_at")

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@map("cost_service_catalog")
}

model FinanceSettings {
  id                 String   @id @default(cuid())
  organizationId     String   @unique @map("organization_id")
  usdToBrlRate       Decimal  @db.Decimal(8, 4) @default(5.30) @map("usd_to_brl_rate")
  defaultHourlyRate  Decimal  @db.Decimal(12, 2) @default(120) @map("default_hourly_rate")
  supportReservePct  Decimal  @db.Decimal(5, 2) @default(10) @map("support_reserve_pct")
  defaultMarginPct   Decimal  @db.Decimal(5, 2) @default(30) @map("default_margin_pct")
  activeClientsCount Int      @default(1) @map("active_clients_count")
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@map("finance_settings")
}

model ProjectProduct {
  id             String   @id @default(cuid())
  organizationId String?  @map("organization_id")
  name           String
  priceMin       Decimal  @db.Decimal(12, 2) @map("price_min")
  priceMax       Decimal  @db.Decimal(12, 2) @map("price_max")
  baseHours      Int?     @map("base_hours")
  description    String?
  order          Int      @default(0)
  isActive       Boolean  @default(true) @map("is_active")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@map("project_products")
}
```

- [ ] **Step 2: Gerar migration sem aplicar**

Run: `pnpm --filter @millead/database exec dotenv -e ../../.env -- prisma migrate dev --create-only --name add_finance_module`
(conferir no `packages/database/package.json` o formato exato do script `db:migrate` e replicar com `--create-only`)

- [ ] **Step 3: Editar a migration gerada** — append no final do `migration.sql`:

```sql
-- Supabase expõe o schema public via PostgREST; sem RLS a tabela fica legível
-- com a anon key (ver README). Nenhuma policy = nega tudo; a API usa a
-- connection string direta (bypassa RLS).
ALTER TABLE "cost_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cost_service_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_products" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Aplicar e gerar client**

Run: `pnpm db:migrate` (aplica a migration pendente) e depois `pnpm db:generate`
Expected: migration aplicada sem erro; client gerado com `prisma.costSubscription`.

- [ ] **Step 5: Type-check do workspace**

Run: `pnpm turbo type-check --filter=@millead/database --filter=@millead/api`
Expected: PASS (nada consome os models ainda).

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma
git commit -m "feat(db): modelos do módulo Financeiro (custos, catálogo, settings, produtos) com RLS"
```

---

### Task 2: Seed — catálogo real, produtos e assinaturas do Rick

**Files:**

- Create: `packages/database/prisma/seed-data/finance.ts`
- Modify: `packages/database/prisma/seed.ts` (chamar a nova função no final do fluxo existente)

**Interfaces:**

- Consumes: models do Task 1.
- Produces: função `seedFinance(prisma: PrismaClient): Promise<void>` exportada de `seed-data/finance.ts`.

- [ ] **Step 1: Criar `seed-data/finance.ts`** — idempotente (upsert por `key`/`name`); espelhar o estilo de `seed-data/briefing-templates.ts`:

```ts
import type { PrismaClient } from "../../src/generated/client/index.js";
// Ajustar o caminho do import ao que seed.ts já usa para o client.

/** Preços de tabela levantados em 31/07/2026 (spec do módulo Financeiro). */
const CATALOG = [
  {
    key: "claude-pro",
    name: "Claude Pro",
    category: "AI",
    defaultAmount: 20,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    bestFor: "IA para código e conteúdo (inclui Claude Code)",
    billingNotes: "US$ 20/mês (US$ 17 no anual)",
  },
  {
    key: "claude-max-5x",
    name: "Claude Max 5x",
    category: "AI",
    defaultAmount: 100,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    bestFor: "Uso pesado de Claude Code",
    billingNotes: "A partir de US$ 100/mês",
  },
  {
    key: "higgsfield-starter",
    name: "Higgsfield Starter",
    category: "AI",
    defaultAmount: 15,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    bestFor: "Geração de imagem/vídeo (200 créditos/mês)",
    billingNotes: "US$ 15/mês no plano anual",
  },
  {
    key: "higgsfield-ultra",
    name: "Higgsfield Ultra",
    category: "AI",
    defaultAmount: 99,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    bestFor: "Geração pesada (≈3.000 créditos/mês)",
    billingNotes: "US$ 99/mês no plano anual",
  },
  {
    key: "vercel-hobby",
    name: "Vercel Hobby",
    category: "HOSTING",
    defaultAmount: 0,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    defaultCapacityLimit: 10,
    bestFor: "Sites pessoais/demonstração (sem uso comercial)",
    billingNotes: "Grátis: 100 GB banda, 1M invocações; sem excedentes",
  },
  {
    key: "vercel-pro",
    name: "Vercel Pro",
    category: "HOSTING",
    defaultAmount: 20,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "CLIENT",
    defaultCapacityLimit: 30,
    bestFor: "Next.js com SSR/ISR/APIs",
    billingNotes: "US$ 20/membro/mês + US$ 20 de crédito de uso; banda 1 TB, depois US$ 0,15/GB",
  },
  {
    key: "supabase-free",
    name: "Supabase Free",
    category: "DATABASE",
    defaultAmount: 0,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    defaultCapacityLimit: 2,
    bestFor: "Protótipos (pausa após 1 semana inativo)",
    billingNotes: "2 projetos, 500 MB banco, 50k MAUs",
  },
  {
    key: "supabase-pro",
    name: "Supabase Pro",
    category: "DATABASE",
    defaultAmount: 25,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "CLIENT",
    defaultCapacityLimit: 6,
    bestFor: "Auth + Postgres de produção",
    billingNotes:
      "US$ 25/mês: 8 GB banco, 100 GB storage; compute Micro US$ 10/projeto (1 crédito incluso)",
  },
  {
    key: "render-free",
    name: "Render Free",
    category: "HOSTING",
    defaultAmount: 0,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    defaultCapacityLimit: 1,
    bestFor: "APIs de teste (dorme após 15 min)",
    billingNotes: "750 h de instância/mês; Postgres free expira em 30 dias",
  },
  {
    key: "render-starter",
    name: "Render Web Starter",
    category: "HOSTING",
    defaultAmount: 7,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "CLIENT",
    defaultCapacityLimit: 1,
    bestFor: "Backend/API pequeno sempre no ar",
    billingNotes: "US$ 7/mês por serviço (512 MB RAM)",
  },
  {
    key: "render-postgres-basic",
    name: "Render Postgres Basic",
    category: "DATABASE",
    defaultAmount: 6,
    currency: "USD",
    billingCycle: "MONTHLY",
    defaultScope: "CLIENT",
    bestFor: "Postgres gerenciado pequeno",
    billingNotes: "US$ 6/mês (256 MB RAM)",
  },
  {
    key: "cloudflare-pages",
    name: "Cloudflare Pages",
    category: "HOSTING",
    defaultAmount: 0,
    currency: "BRL",
    billingCycle: "MONTHLY",
    defaultScope: "CLIENT",
    defaultCapacityLimit: 20,
    bestFor: "Landing pages e sites estáticos",
    billingNotes: "Plano gratuito generoso; padrão para LP sem backend",
  },
  {
    key: "registrobr-domain",
    name: "Domínio .br (Registro.br)",
    category: "DOMAIN",
    defaultAmount: 40,
    currency: "BRL",
    billingCycle: "YEARLY",
    defaultScope: "CLIENT",
    bestFor: "Domínio nacional do cliente",
    billingNotes: "R$ 40/ano por domínio",
  },
  {
    key: "github-free",
    name: "GitHub Free",
    category: "OTHER",
    defaultAmount: 0,
    currency: "BRL",
    billingCycle: "MONTHLY",
    defaultScope: "AGENCY",
    bestFor: "Repositórios privados ilimitados",
    billingNotes: "Grátis para o uso atual",
  },
] as const;

const PRODUCTS = [
  {
    name: "Landing Page Essencial",
    priceMin: 2000,
    priceMax: 3500,
    baseHours: 24,
    description: "1 página, foco em conversão, CTA WhatsApp",
    order: 1,
  },
  {
    name: "Landing Page Premium",
    priceMin: 3500,
    priceMax: 6000,
    baseHours: 40,
    description: "Animações, vídeo, SEO, scroll cinematográfico",
    order: 2,
  },
  {
    name: "Site Institucional",
    priceMin: 5000,
    priceMax: 8000,
    baseHours: 60,
    description: "5–8 páginas, credibilidade e autoridade",
    order: 3,
  },
  {
    name: "Site Institucional Premium",
    priceMin: 8000,
    priceMax: 15000,
    baseHours: 90,
    description: "Design exclusivo, CMS, animações",
    order: 4,
  },
  {
    name: "Sistema Web / SaaS",
    priceMin: 15000,
    priceMax: 40000,
    baseHours: 150,
    description: "Aplicação sob medida com backend",
    order: 5,
  },
] as const;

/**
 * Assinaturas reais do Rick (valores declarados em 31/07/2026, fatura em BRL).
 * capacityUsed é estimativa inicial -- tudo editável na UI depois.
 */
const RICK_SUBSCRIPTIONS = [
  {
    serviceKey: "claude-max-5x",
    name: "Claude Max 5x",
    scope: "AGENCY",
    amount: 550,
    currency: "BRL",
    billingCycle: "MONTHLY",
    notes: "Valor real no cartão (US$ 100 + câmbio/IOF)",
  },
  {
    serviceKey: "higgsfield-starter",
    name: "Higgsfield",
    scope: "AGENCY",
    amount: 239,
    currency: "BRL",
    billingCycle: "MONTHLY",
    notes: "Plano mais barato, valor real no cartão",
  },
  {
    serviceKey: "vercel-hobby",
    name: "Vercel Hobby",
    scope: "AGENCY",
    amount: 0,
    currency: "BRL",
    billingCycle: "MONTHLY",
    capacityLimit: 15,
    capacityUsed: 12,
    notes: "Sites da MilWeb e demos no ar (estimativa, ajustar)",
  },
  {
    serviceKey: "supabase-free",
    name: "Supabase Free",
    scope: "AGENCY",
    amount: 0,
    currency: "BRL",
    billingCycle: "MONTHLY",
    capacityLimit: 2,
    capacityUsed: 1,
    notes: "Banco da MilLead",
  },
  {
    serviceKey: "render-free",
    name: "Render Free",
    scope: "AGENCY",
    amount: 0,
    currency: "BRL",
    billingCycle: "MONTHLY",
    capacityLimit: 1,
    capacityUsed: 1,
    notes: "millead-api",
  },
  {
    serviceKey: "registrobr-domain",
    name: "Domínio milweb.com.br",
    scope: "AGENCY",
    amount: 40,
    currency: "BRL",
    billingCycle: "YEARLY",
    notes: "Registro.br",
  },
] as const;

export async function seedFinance(prisma: PrismaClient): Promise<void> {
  for (const item of CATALOG) {
    await prisma.costServiceCatalog.upsert({
      where: { key: item.key },
      update: { ...item },
      create: { ...item },
    });
  }

  // Produtos globais (organizationId NULL): upsert manual por nome.
  for (const product of PRODUCTS) {
    const existing = await prisma.projectProduct.findFirst({
      where: { organizationId: null, name: product.name },
    });
    if (existing) {
      await prisma.projectProduct.update({ where: { id: existing.id }, data: { ...product } });
    } else {
      await prisma.projectProduct.create({ data: { ...product } });
    }
  }

  // Bootstrap: orgs sem NENHUMA assinatura ganham as assinaturas reais como
  // ponto de partida (na prática só existe a org da MilWeb em produção).
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  for (const org of orgs) {
    const count = await prisma.costSubscription.count({ where: { organizationId: org.id } });
    if (count > 0) continue;
    await prisma.costSubscription.createMany({
      data: RICK_SUBSCRIPTIONS.map((s) => ({ ...s, organizationId: org.id })),
    });
    await prisma.financeSettings.upsert({
      where: { organizationId: org.id },
      update: {},
      create: { organizationId: org.id },
    });
  }
}
```

(Se o type-check reclamar dos `as const` vs enums, tipar os arrays com os tipos gerados do client — ex.: `Prisma.CostServiceCatalogUpsertArgs["create"][]` — ou remover `as const` e anotar os campos enum com o tipo do client.)

- [ ] **Step 2: Chamar no `seed.ts`** — no final da função main existente:

```ts
import { seedFinance } from "./seed-data/finance.js"; // conferir extensão/estilo dos imports vizinhos
// ...
await seedFinance(prisma);
```

- [ ] **Step 3: Rodar o seed**

Run: `pnpm db:seed`
Expected: termina sem erro. Verificar: `pnpm --filter @millead/database exec dotenv -e ../../.env -- prisma studio` OU um `SELECT` rápido — 14 linhas em `cost_service_catalog`, 5 em `project_products`, ≥6 em `cost_subscriptions`.

- [ ] **Step 4: Rodar o seed DE NOVO** (idempotência)

Run: `pnpm db:seed`
Expected: sem erro e sem duplicatas (mesmas contagens).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/seed.ts packages/database/prisma/seed-data/finance.ts
git commit -m "feat(db): seed do Financeiro -- catálogo com preços reais, produtos e assinaturas da MilWeb"
```

---

### Task 3: API — domínio, DTOs e repositório

**Files:**

- Create: `apps/api/src/domain/entities/cost.ts`
- Create: `apps/api/src/domain/repositories/cost-repository.ts`
- Create: `apps/api/src/application/dto/cost.dto.ts`
- Create: `apps/api/src/infrastructure/prisma/prisma-cost-repository.ts`

**Interfaces:**

- Consumes: client Prisma do Task 1.
- Produces: interface `CostRepository` e classe `PrismaCostRepository` com: `listSubscriptions(organizationId)`, `findSubscriptionById(organizationId, id)`, `createSubscription(organizationId, data: CreateCostSubscriptionInput)`, `updateSubscription(organizationId, id, data: UpdateCostSubscriptionInput)` (retorna `null` se não achou), `deleteSubscription(organizationId, id)` (retorna `boolean`), `listCatalog(organizationId)`, `getSettings(organizationId)` (upsert-cria default), `updateSettings(organizationId, data: UpdateFinanceSettingsInput)`, `listActiveAgencyAndClientTotals` não existe — totais são calculados no service a partir de `listSubscriptions`. Também `countWonLeads(organizationId)`.

- [ ] **Step 1: Entities** — `apps/api/src/domain/entities/cost.ts`:

```ts
import type { CostSubscription, CostServiceCatalog, FinanceSettings } from "@millead/database";

export type { CostSubscription, CostServiceCatalog, FinanceSettings };

/** Resumo financeiro da org -- números já convertidos pra BRL/mês. */
export interface CostSummary {
  agencyMonthlyBrl: number;
  clientMonthlyBrl: number;
  totalMonthlyBrl: number;
  perClientShareBrl: number;
  activeClientsCount: number;
  /** Sugestão exibida ao lado do campo manual. */
  wonLeadsCount: number;
  activeSubscriptions: number;
}
```

(Se `@millead/database` não re-exportar os tipos do client, importar de `@millead/database` o que o resto do código usa — conferir como `prisma-tag-repository.ts` importa e seguir igual; em último caso `import type { CostSubscription } from "@millead/database"` vira o tipo do client gerado.)

- [ ] **Step 2: DTOs** — `apps/api/src/application/dto/cost.dto.ts`:

```ts
import { z } from "zod";

const money = z.number().min(0).max(9_999_999);

export const createCostSubscriptionSchema = z.object({
  name: z.string().min(2).max(80),
  scope: z.enum(["AGENCY", "CLIENT"]),
  amount: money,
  currency: z.enum(["BRL", "USD"]).default("BRL"),
  billingCycle: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  serviceKey: z.string().max(60).optional().nullable(),
  companyId: z.string().cuid().optional().nullable(),
  capacityLimit: z.number().int().min(0).max(100000).optional().nullable(),
  capacityUsed: z.number().int().min(0).max(100000).optional().nullable(),
  isActive: z.boolean().default(true),
  notes: z.string().max(500).optional().nullable(),
});
export type CreateCostSubscriptionInput = z.infer<typeof createCostSubscriptionSchema>;

export const updateCostSubscriptionSchema = createCostSubscriptionSchema.partial();
export type UpdateCostSubscriptionInput = z.infer<typeof updateCostSubscriptionSchema>;

export const updateFinanceSettingsSchema = z.object({
  usdToBrlRate: z.number().min(0.01).max(1000).optional(),
  defaultHourlyRate: money.optional(),
  supportReservePct: z.number().min(0).max(100).optional(),
  defaultMarginPct: z.number().min(0).max(500).optional(),
  activeClientsCount: z.number().int().min(1).max(10000).optional(),
});
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
```

- [ ] **Step 3: Interface do repositório** — `apps/api/src/domain/repositories/cost-repository.ts`:

```ts
import type {
  CreateCostSubscriptionInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../../application/dto/cost.dto.js";
import type { CostSubscription, CostServiceCatalog, FinanceSettings } from "../entities/cost.js";

export interface CostRepository {
  listSubscriptions(organizationId: string): Promise<CostSubscription[]>;
  findSubscriptionById(organizationId: string, id: string): Promise<CostSubscription | null>;
  createSubscription(
    organizationId: string,
    data: CreateCostSubscriptionInput,
  ): Promise<CostSubscription>;
  updateSubscription(
    organizationId: string,
    id: string,
    data: UpdateCostSubscriptionInput,
  ): Promise<CostSubscription | null>;
  deleteSubscription(organizationId: string, id: string): Promise<boolean>;
  listCatalog(organizationId: string): Promise<CostServiceCatalog[]>;
  getSettings(organizationId: string): Promise<FinanceSettings>;
  updateSettings(
    organizationId: string,
    data: UpdateFinanceSettingsInput,
  ): Promise<FinanceSettings>;
  countWonLeads(organizationId: string): Promise<number>;
}
```

- [ ] **Step 4: Implementação Prisma** — `apps/api/src/infrastructure/prisma/prisma-cost-repository.ts`:

```ts
import { prisma } from "@millead/database";
import type {
  CreateCostSubscriptionInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../../application/dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type {
  CostSubscription,
  CostServiceCatalog,
  FinanceSettings,
} from "../../domain/entities/cost.js";

export class PrismaCostRepository implements CostRepository {
  listSubscriptions(organizationId: string): Promise<CostSubscription[]> {
    return prisma.costSubscription.findMany({
      where: { organizationId },
      orderBy: [{ scope: "asc" }, { isActive: "desc" }, { name: "asc" }],
    });
  }

  findSubscriptionById(organizationId: string, id: string): Promise<CostSubscription | null> {
    return prisma.costSubscription.findFirst({ where: { id, organizationId } });
  }

  createSubscription(
    organizationId: string,
    data: CreateCostSubscriptionInput,
  ): Promise<CostSubscription> {
    return prisma.costSubscription.create({ data: { ...data, organizationId } });
  }

  async updateSubscription(
    organizationId: string,
    id: string,
    data: UpdateCostSubscriptionInput,
  ): Promise<CostSubscription | null> {
    const existing = await this.findSubscriptionById(organizationId, id);
    if (!existing) return null;
    return prisma.costSubscription.update({ where: { id }, data });
  }

  async deleteSubscription(organizationId: string, id: string): Promise<boolean> {
    const existing = await this.findSubscriptionById(organizationId, id);
    if (!existing) return false;
    await prisma.costSubscription.delete({ where: { id } });
    return true;
  }

  listCatalog(organizationId: string): Promise<CostServiceCatalog[]> {
    // Globais (organizationId NULL) + customs da própria org (padrão Briefings).
    return prisma.costServiceCatalog.findMany({
      where: { isActive: true, OR: [{ organizationId: null }, { organizationId }] },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async getSettings(organizationId: string): Promise<FinanceSettings> {
    return prisma.financeSettings.upsert({
      where: { organizationId },
      update: {},
      create: { organizationId },
    });
  }

  updateSettings(
    organizationId: string,
    data: UpdateFinanceSettingsInput,
  ): Promise<FinanceSettings> {
    return prisma.financeSettings.upsert({
      where: { organizationId },
      update: data,
      create: { organizationId, ...data },
    });
  }

  countWonLeads(organizationId: string): Promise<number> {
    return prisma.lead.count({ where: { organizationId, status: "WON" } });
  }
}
```

- [ ] **Step 5: Type-check**

Run: `pnpm turbo type-check --filter=@millead/api`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/domain apps/api/src/application/dto/cost.dto.ts apps/api/src/infrastructure/prisma/prisma-cost-repository.ts
git commit -m "feat(api): entidades, DTOs e repositório do Centro de Custos"
```

---

### Task 4: API — CostService com cálculo + testes unitários (TDD)

**Files:**

- Create: `apps/api/src/application/services/cost-service.test.ts` (antes de existir o service; conferir se testes existentes ficam colocalizados — `Glob apps/api/src/**/*.test.ts` — e seguir a convenção encontrada)
- Create: `apps/api/src/application/services/cost-service.ts`

**Interfaces:**

- Consumes: `CostRepository` (Task 3).
- Produces: `CostService` com `listSubscriptions`, `createSubscription`, `updateSubscription` (lança `NotFoundError` se null — conferir a classe de erro usada nos services existentes, ex. no `proposal-service.ts`, e usar a mesma), `deleteSubscription`, `listCatalog`, `getSettings`, `updateSettings`, `getSummary(organizationId): Promise<CostSummary>`. Helper puro exportado: `monthlyAmountBrl(amount: number, currency: "BRL" | "USD", billingCycle: "MONTHLY" | "YEARLY", usdToBrlRate: number): number`.

- [ ] **Step 1: Escrever os testes que falham** — `cost-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { monthlyAmountBrl, computeSummary } from "./cost-service.js";

describe("monthlyAmountBrl", () => {
  it("mantém BRL mensal como está", () => {
    expect(monthlyAmountBrl(550, "BRL", "MONTHLY", 5.3)).toBe(550);
  });
  it("converte USD pelo câmbio", () => {
    expect(monthlyAmountBrl(20, "USD", "MONTHLY", 5.3)).toBe(106);
  });
  it("divide anual por 12 (2 casas)", () => {
    expect(monthlyAmountBrl(40, "BRL", "YEARLY", 5.3)).toBeCloseTo(3.33, 2);
  });
  it("USD anual: converte e divide", () => {
    expect(monthlyAmountBrl(120, "USD", "YEARLY", 5.0)).toBeCloseTo(50, 2);
  });
});

describe("computeSummary", () => {
  const subs = [
    { scope: "AGENCY", amount: 550, currency: "BRL", billingCycle: "MONTHLY", isActive: true },
    { scope: "AGENCY", amount: 239, currency: "BRL", billingCycle: "MONTHLY", isActive: true },
    { scope: "AGENCY", amount: 40, currency: "BRL", billingCycle: "YEARLY", isActive: true },
    { scope: "CLIENT", amount: 20, currency: "USD", billingCycle: "MONTHLY", isActive: true },
    { scope: "AGENCY", amount: 999, currency: "BRL", billingCycle: "MONTHLY", isActive: false },
  ] as const;

  it("soma só ativos, separa escopos e rateia por clientes ativos", () => {
    const s = computeSummary([...subs], { usdToBrlRate: 5, activeClientsCount: 2 }, 7);
    expect(s.agencyMonthlyBrl).toBeCloseTo(550 + 239 + 40 / 12, 2);
    expect(s.clientMonthlyBrl).toBeCloseTo(100, 2);
    expect(s.totalMonthlyBrl).toBeCloseTo(s.agencyMonthlyBrl + 100, 2);
    expect(s.perClientShareBrl).toBeCloseTo(s.agencyMonthlyBrl / 2, 2);
    expect(s.activeClientsCount).toBe(2);
    expect(s.wonLeadsCount).toBe(7);
    expect(s.activeSubscriptions).toBe(4);
  });

  it("nunca divide por zero", () => {
    const s = computeSummary([...subs], { usdToBrlRate: 5, activeClientsCount: 0 }, 0);
    expect(s.perClientShareBrl).toBe(s.agencyMonthlyBrl);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @millead/api exec vitest run src/application/services/cost-service.test.ts`
Expected: FAIL — módulo `cost-service.js` não existe.

- [ ] **Step 3: Implementar** — `cost-service.ts`:

```ts
import type {
  CreateCostSubscriptionInput,
  UpdateCostSubscriptionInput,
  UpdateFinanceSettingsInput,
} from "../dto/cost.dto.js";
import type { CostRepository } from "../../domain/repositories/cost-repository.js";
import type { CostSummary } from "../../domain/entities/cost.js";

type Currency = "BRL" | "USD";
type Cycle = "MONTHLY" | "YEARLY";

/** Normaliza qualquer custo pra BRL/mês. Números JS bastam: valores pequenos e exibidos arredondados. */
export function monthlyAmountBrl(
  amount: number,
  currency: Currency,
  billingCycle: Cycle,
  usdToBrlRate: number,
): number {
  const brl = currency === "USD" ? amount * usdToBrlRate : amount;
  return billingCycle === "YEARLY" ? brl / 12 : brl;
}

interface SummarySubscription {
  scope: "AGENCY" | "CLIENT";
  amount: number | { toString(): string };
  currency: Currency;
  billingCycle: Cycle;
  isActive: boolean;
}

/** Puro pra ser testável sem repo -- o service delega aqui. */
export function computeSummary(
  subscriptions: readonly SummarySubscription[],
  settings: { usdToBrlRate: number | { toString(): string }; activeClientsCount: number },
  wonLeadsCount: number,
): CostSummary {
  const rate = Number(settings.usdToBrlRate);
  const active = subscriptions.filter((s) => s.isActive);
  const sum = (scope: "AGENCY" | "CLIENT") =>
    active
      .filter((s) => s.scope === scope)
      .reduce(
        (acc, s) => acc + monthlyAmountBrl(Number(s.amount), s.currency, s.billingCycle, rate),
        0,
      );

  const agencyMonthlyBrl = sum("AGENCY");
  const clientMonthlyBrl = sum("CLIENT");
  const clients = Math.max(settings.activeClientsCount, 1);
  return {
    agencyMonthlyBrl,
    clientMonthlyBrl,
    totalMonthlyBrl: agencyMonthlyBrl + clientMonthlyBrl,
    perClientShareBrl: agencyMonthlyBrl / clients,
    activeClientsCount: settings.activeClientsCount,
    wonLeadsCount,
    activeSubscriptions: active.length,
  };
}

export class CostService {
  constructor(private readonly repository: CostRepository) {}

  listSubscriptions(organizationId: string) {
    return this.repository.listSubscriptions(organizationId);
  }

  createSubscription(organizationId: string, input: CreateCostSubscriptionInput) {
    return this.repository.createSubscription(organizationId, input);
  }

  async updateSubscription(organizationId: string, id: string, input: UpdateCostSubscriptionInput) {
    const updated = await this.repository.updateSubscription(organizationId, id, input);
    if (!updated) throw new NotFoundError("Assinatura não encontrada");
    return updated;
  }

  async deleteSubscription(organizationId: string, id: string) {
    const ok = await this.repository.deleteSubscription(organizationId, id);
    if (!ok) throw new NotFoundError("Assinatura não encontrada");
  }

  listCatalog(organizationId: string) {
    return this.repository.listCatalog(organizationId);
  }

  getSettings(organizationId: string) {
    return this.repository.getSettings(organizationId);
  }

  updateSettings(organizationId: string, input: UpdateFinanceSettingsInput) {
    return this.repository.updateSettings(organizationId, input);
  }

  async getSummary(organizationId: string): Promise<CostSummary> {
    const [subscriptions, settings, wonLeads] = await Promise.all([
      this.repository.listSubscriptions(organizationId),
      this.repository.getSettings(organizationId),
      this.repository.countWonLeads(organizationId),
    ]);
    return computeSummary(
      subscriptions.map((s) => ({
        scope: s.scope,
        amount: Number(s.amount),
        currency: s.currency,
        billingCycle: s.billingCycle,
        isActive: s.isActive,
      })),
      {
        usdToBrlRate: Number(settings.usdToBrlRate),
        activeClientsCount: settings.activeClientsCount,
      },
      wonLeads,
    );
  }
}
```

**`NotFoundError`**: NÃO inventar — procurar a classe de erro que os services existentes lançam para 404 (`Grep "NotFoundError\|AppError" apps/api/src/application`) e importar a mesma. Se o padrão for outro (ex.: `HttpError(404, ...)`), usar o padrão do repo.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @millead/api exec vitest run src/application/services/cost-service.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/application/services/cost-service.ts apps/api/src/application/services/cost-service.test.ts
git commit -m "feat(api): CostService com normalização BRL/mês, rateio e testes"
```

---

### Task 5: API — controller, rotas, container e app

**Files:**

- Create: `apps/api/src/interfaces/http/controllers/cost-controller.ts`
- Create: `apps/api/src/interfaces/http/routes/cost-routes.ts`
- Modify: `apps/api/src/main/container.ts` (instanciar repo/service/controller, expor `costController`)
- Modify: `apps/api/src/main/app.ts` (montar `/api/v1/costs`)

**Interfaces:**

- Consumes: `CostService` (Task 4), `PrismaCostRepository` (Task 3), padrão `requireAuth`/`asyncHandler`/`validateBody` existentes.
- Produces: rotas `GET|POST /api/v1/costs`, `PATCH|DELETE /api/v1/costs/:id`, `GET /api/v1/costs/catalog`, `GET|PATCH /api/v1/costs/settings`, `GET /api/v1/costs/summary`.

- [ ] **Step 1: Controller** — `cost-controller.ts` (métodos arrow, padrão TagController):

```ts
import type { Request, Response } from "express";
import type { CostService } from "../../../application/services/cost-service.js";
import { requireAuth } from "../require-auth.js";

export class CostController {
  constructor(private readonly costs: CostService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.listSubscriptions(auth.organizationId));
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(201).json(await this.costs.createSubscription(auth.organizationId, req.body));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res
      .status(200)
      .json(await this.costs.updateSubscription(auth.organizationId, req.params.id, req.body));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    await this.costs.deleteSubscription(auth.organizationId, req.params.id);
    res.status(204).end();
  };

  catalog = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.listCatalog(auth.organizationId));
  };

  getSettings = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.getSettings(auth.organizationId));
  };

  updateSettings = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.updateSettings(auth.organizationId, req.body));
  };

  summary = async (req: Request, res: Response): Promise<void> => {
    const auth = requireAuth(req);
    res.status(200).json(await this.costs.getSummary(auth.organizationId));
  };
}
```

- [ ] **Step 2: Rotas** — `cost-routes.ts` (rotas fixas ANTES de `/:id`):

```ts
import { PERMISSIONS } from "@millead/database/permissions";
import { Router, type RequestHandler } from "express";
import {
  createCostSubscriptionSchema,
  updateCostSubscriptionSchema,
  updateFinanceSettingsSchema,
} from "../../../application/dto/cost.dto.js";
import { asyncHandler } from "../async-handler.js";
import type { CostController } from "../controllers/cost-controller.js";
import { requirePermission } from "../middlewares/require-permission.js";
import { validateBody } from "../middlewares/validate.js";

// Centro de Custos reusa proposals:* (decisão da spec do módulo Financeiro):
// quem gerencia propostas gerencia custos -- evita crescer o catálogo de
// permissões e re-seed em produção (mesmo atalho de Contratos/Briefings).
export function createCostRoutes(controller: CostController, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  const read = requirePermission(PERMISSIONS.PROPOSALS_READ);
  const write = requirePermission(PERMISSIONS.PROPOSALS_WRITE);

  router.get("/catalog", read, asyncHandler(controller.catalog));
  router.get("/settings", read, asyncHandler(controller.getSettings));
  router.patch(
    "/settings",
    write,
    validateBody(updateFinanceSettingsSchema),
    asyncHandler(controller.updateSettings),
  );
  router.get("/summary", read, asyncHandler(controller.summary));
  router.get("/", read, asyncHandler(controller.list));
  router.post(
    "/",
    write,
    validateBody(createCostSubscriptionSchema),
    asyncHandler(controller.create),
  );
  router.patch(
    "/:id",
    write,
    validateBody(updateCostSubscriptionSchema),
    asyncHandler(controller.update),
  );
  router.delete("/:id", write, asyncHandler(controller.remove));

  return router;
}
```

(Conferir os nomes exatos das constantes em `packages/database/src/permissions.ts` — se forem `PERMISSIONS["proposals:read"]` ou outra forma, seguir o que `proposal-routes.ts` usa.)

- [ ] **Step 3: Container** — em `main/container.ts`, seguir o bloco de um módulo existente (ex.: tags): instanciar `new PrismaCostRepository()`, `new CostService(costRepository)`, `new CostController(costService)` e adicionar `costController` ao objeto/`interface Container` retornado.

- [ ] **Step 4: App** — em `main/app.ts`, junto das outras montagens:

```ts
import { createCostRoutes } from "../interfaces/http/routes/cost-routes.js";
// ...
app.use("/api/v1/costs", createCostRoutes(container.costController, container.authenticate));
```

- [ ] **Step 5: Type-check + testes + smoke local**

Run: `pnpm turbo type-check --filter=@millead/api && pnpm --filter @millead/api exec vitest run`
Expected: PASS.
Smoke: subir `pnpm --filter @millead/api dev` e `curl -s http://localhost:<porta>/api/v1/costs` → 401 (sem token) prova que a rota montou. Derrubar o dev depois.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): rotas /api/v1/costs (assinaturas, catálogo, settings, summary)"
```

---

### Task 6: Web — tipos, service e hooks

**Files:**

- Modify: `apps/web/src/types/api.ts` (append)
- Create: `apps/web/src/services/costs.ts`
- Modify: `apps/web/src/lib/query-keys.ts` (append `costs`)
- Create: `apps/web/src/features/finance/hooks.ts`
- Create: `apps/web/src/features/finance/finance-labels.ts`

**Interfaces:**

- Consumes: endpoints do Task 5; `api` client (`services/api-client.ts`).
- Produces: tipos `CostSubscription`, `CostServiceCatalogItem`, `FinanceSettings`, `CostSummary`; `costsService`; hooks `useCostSubscriptions`, `useCostCatalog`, `useFinanceSettings`, `useCostSummary`, `useCreateCostSubscription`, `useUpdateCostSubscription`, `useDeleteCostSubscription`, `useUpdateFinanceSettings`; labels `SCOPE_LABELS`, `CYCLE_LABELS`, `CATEGORY_LABELS`.

- [ ] **Step 1: Tipos** — append em `types/api.ts` (decimais como **string**, padrão `Proposal.value`):

```ts
// --- Financeiro (Fase 1) ---
export type CostScope = "AGENCY" | "CLIENT";
export type CostCurrency = "BRL" | "USD";
export type CostBillingCycle = "MONTHLY" | "YEARLY";
export type CostCategory =
  "HOSTING" | "DATABASE" | "AI" | "DOMAIN" | "EMAIL" | "SIGNATURE" | "OTHER";

export interface CostSubscription {
  id: string;
  organizationId: string;
  companyId: string | null;
  serviceKey: string | null;
  name: string;
  scope: CostScope;
  amount: string;
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  capacityLimit: number | null;
  capacityUsed: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostServiceCatalogItem {
  id: string;
  key: string;
  name: string;
  category: CostCategory;
  defaultAmount: string;
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  defaultScope: CostScope;
  defaultCapacityLimit: number | null;
  bestFor: string | null;
  billingNotes: string | null;
}

export interface FinanceSettings {
  id: string;
  organizationId: string;
  usdToBrlRate: string;
  defaultHourlyRate: string;
  supportReservePct: string;
  defaultMarginPct: string;
  activeClientsCount: number;
}

export interface CostSummary {
  agencyMonthlyBrl: number;
  clientMonthlyBrl: number;
  totalMonthlyBrl: number;
  perClientShareBrl: number;
  activeClientsCount: number;
  wonLeadsCount: number;
  activeSubscriptions: number;
}

export interface CostSubscriptionPayload {
  name: string;
  scope: CostScope;
  amount: number;
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  serviceKey?: string | null;
  companyId?: string | null;
  capacityLimit?: number | null;
  capacityUsed?: number | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface FinanceSettingsPayload {
  usdToBrlRate?: number;
  defaultHourlyRate?: number;
  supportReservePct?: number;
  defaultMarginPct?: number;
  activeClientsCount?: number;
}
```

- [ ] **Step 2: Service** — `services/costs.ts`:

```ts
import { api } from "./api-client";
import type {
  CostSubscription,
  CostServiceCatalogItem,
  CostSubscriptionPayload,
  CostSummary,
  FinanceSettings,
  FinanceSettingsPayload,
} from "@/types/api";

export const costsService = {
  list: () => api.get<CostSubscription[]>("/api/v1/costs"),
  create: (payload: CostSubscriptionPayload) =>
    api.post<CostSubscription>("/api/v1/costs", payload),
  update: (id: string, payload: Partial<CostSubscriptionPayload>) =>
    api.patch<CostSubscription>(`/api/v1/costs/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/api/v1/costs/${id}`),
  catalog: () => api.get<CostServiceCatalogItem[]>("/api/v1/costs/catalog"),
  settings: () => api.get<FinanceSettings>("/api/v1/costs/settings"),
  updateSettings: (payload: FinanceSettingsPayload) =>
    api.patch<FinanceSettings>("/api/v1/costs/settings", payload),
  summary: () => api.get<CostSummary>("/api/v1/costs/summary"),
};
```

(Conferir em `api-client.ts` se existe `api.delete`/`api.patch` — se os nomes diferirem, ex. `api.del`, usar o real.)

- [ ] **Step 3: Query keys** — append em `lib/query-keys.ts` dentro do objeto:

```ts
costs: {
  list: () => ["costs", "list"] as const,
  catalog: () => ["costs", "catalog"] as const,
  settings: () => ["costs", "settings"] as const,
  summary: () => ["costs", "summary"] as const,
},
```

- [ ] **Step 4: Hooks** — `features/finance/hooks.ts` (padrão dos hooks existentes, ex. `features/proposals/hooks.ts` — invalidar `list` E `summary` nas mutações):

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { costsService } from "@/services/costs";
import type { CostSubscriptionPayload, FinanceSettingsPayload } from "@/types/api";

export function useCostSubscriptions() {
  return useQuery({ queryKey: queryKeys.costs.list(), queryFn: costsService.list });
}

export function useCostCatalog() {
  return useQuery({ queryKey: queryKeys.costs.catalog(), queryFn: costsService.catalog });
}

export function useFinanceSettings() {
  return useQuery({ queryKey: queryKeys.costs.settings(), queryFn: costsService.settings });
}

export function useCostSummary() {
  return useQuery({ queryKey: queryKeys.costs.summary(), queryFn: costsService.summary });
}

function useInvalidateCosts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["costs"] });
  };
}

export function useCreateCostSubscription() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: (payload: CostSubscriptionPayload) => costsService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpdateCostSubscription() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CostSubscriptionPayload> }) =>
      costsService.update(id, payload),
    onSuccess: invalidate,
  });
}

export function useDeleteCostSubscription() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: (id: string) => costsService.remove(id),
    onSuccess: invalidate,
  });
}

export function useUpdateFinanceSettings() {
  const invalidate = useInvalidateCosts();
  return useMutation({
    mutationFn: (payload: FinanceSettingsPayload) => costsService.updateSettings(payload),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 5: Labels** — `features/finance/finance-labels.ts`:

```ts
import type { CostBillingCycle, CostCategory, CostScope } from "@/types/api";

export const SCOPE_LABELS: Record<CostScope, string> = {
  AGENCY: "Agência",
  CLIENT: "Por cliente",
};

export const CYCLE_LABELS: Record<CostBillingCycle, string> = {
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

export const CATEGORY_LABELS: Record<CostCategory, string> = {
  HOSTING: "Hospedagem",
  DATABASE: "Banco de dados",
  AI: "IA",
  DOMAIN: "Domínio",
  EMAIL: "E-mail",
  SIGNATURE: "Assinatura digital",
  OTHER: "Outros",
};
```

- [ ] **Step 6: Type-check e commit**

Run: `pnpm turbo type-check --filter=@millead/web`
Expected: PASS.

```bash
git add apps/web/src
git commit -m "feat(web): tipos, service e hooks do Centro de Custos"
```

---

### Task 7: Web — página /costs (cards, tabela, dialogs)

**Files:**

- Create: `apps/web/src/app/(app)/costs/page.tsx`
- Create: `apps/web/src/features/finance/components/cost-summary-cards.tsx`
- Create: `apps/web/src/features/finance/components/cost-subscriptions-list.tsx`
- Create: `apps/web/src/features/finance/components/cost-subscription-dialog.tsx`
- Create: `apps/web/src/features/finance/components/finance-settings-dialog.tsx`

**Interfaces:**

- Consumes: hooks e labels do Task 6; `components/ui/*`; `formatCurrency` de `src/utils/format.ts`; `EmptyState`, `ConfirmDialog` de `components/`.
- Produces: página completa em `/costs`.

**Referências de padrão obrigatórias antes de codar:** `app/(app)/proposals/page.tsx` (estrutura de página), `features/proposals/components/create-proposal-dialog.tsx` (RHF + zodResolver em Dialog, erros à mão com `<p className="text-xs text-destructive">`), `features/dashboard/components/stat-card.tsx` (cards de número).

- [ ] **Step 1: `cost-summary-cards.tsx`** — 4 `StatCard` (ou `Card` simples se `StatCard` for acoplado ao dashboard): "Custo fixo mensal" (`agencyMonthlyBrl`), "Infra de clientes/mês" (`clientMonthlyBrl`), "Rateio por cliente ativo" (`perClientShareBrl`, descrição "R$ X ÷ N clientes"), "Assinaturas ativas" (`activeSubscriptions`). Valores com `formatCurrency`. Skeleton enquanto `isLoading`.

- [ ] **Step 2: `cost-subscription-dialog.tsx`** — Dialog RHF+Zod usado para criar E editar (prop `subscription?: CostSubscription`):
  - Schema local zod: `name` (min 2), `scope`, `amount` (`z.coerce.number().min(0)`), `currency`, `billingCycle`, `capacityLimit`/`capacityUsed` (`z.coerce.number().int().min(0).optional()`), `notes` opcional.
  - No modo criar: `<Select>` "A partir do catálogo (opcional)" listando `useCostCatalog()` agrupado por `CATEGORY_LABELS`; ao escolher, pré-preencher `name`, `scope=defaultScope`, `amount=Number(defaultAmount)`, `currency`, `billingCycle`, `capacityLimit=defaultCapacityLimit`, `serviceKey=key` e mostrar `billingNotes`/`bestFor` como texto auxiliar. Campos continuam todos editáveis (requisito do Rick: preço subiu/baixou, ele muda).
  - Ao lado do campo `amount` quando `currency === "USD"`: linha "≈ R$ X/mês no câmbio atual" usando `usdToBrlRate` de `useFinanceSettings()` e a regra mensal (÷12 se anual).
  - Submit chama `useCreateCostSubscription` ou `useUpdateCostSubscription`; toast `sonner` de sucesso/erro (padrão dos dialogs existentes).

- [ ] **Step 3: `cost-subscriptions-list.tsx`** — tabela (padrão `proposals-list.tsx`): colunas Nome (+ `notes` em texto menor), Escopo (`Badge` com `SCOPE_LABELS`), Valor (`formatCurrency(Number(amount))` + sufixo `/mês` ou `/ano`; se USD, mostrar "US$ X" e a conversão embaixo), Capacidade (`{capacityUsed}/{capacityLimit}` quando ambos existem, senão "—"), Ativa (`<Switch>` que dispara `useUpdateCostSubscription` com `{ isActive }` direto na linha), Ações (editar abre o dialog; excluir abre `ConfirmDialog` → `useDeleteCostSubscription`). Estados: skeleton, erro (`ErrorState`), vazio (`EmptyState` com CTA "Adicionar assinatura"). Filtro simples por escopo (`<Select>`: Todas / Agência / Por cliente) via estado local.

- [ ] **Step 4: `finance-settings-dialog.tsx`** — Dialog RHF+Zod sobre `useFinanceSettings`/`useUpdateFinanceSettings`: câmbio USD→BRL (`z.coerce.number().min(0.01)`, descrição "use um valor com folga pra IOF/spread — hoje US$ 1 ≈ R$ 5,07"), valor/hora padrão, reserva de suporte %, margem padrão %, clientes ativos (int ≥ 1, com texto auxiliar "sugestão: N leads ganhos" vindo de `summary.wonLeadsCount`).

- [ ] **Step 5: `page.tsx`** — client page (padrão proposals): header "Centro de Custos" + subtítulo "Quanto custa manter a MilWeb e quanto cada cliente consome" + botões "Configurações" (abre settings dialog) e "Adicionar assinatura" (abre dialog de criação); depois `<CostSummaryCards />`; depois `<Card>` com filtro + `<CostSubscriptionsList />`.

- [ ] **Step 6: Verificação visual**

Run: `pnpm dev` na raiz (ou `pnpm --filter @millead/web dev` + API), logar na MilLead local, navegar até `/costs` digitando a URL.
Expected: cards com R$ 550 + R$ 239 + rateio; tabela com as 6 assinaturas do seed; criar/editar/desativar/excluir funcionando (testar 1 de cada); settings salvando.

- [ ] **Step 7: Lint + type-check + commit**

Run: `pnpm turbo lint type-check --filter=@millead/web`
Expected: PASS.

```bash
git add apps/web/src
git commit -m "feat(web): página /costs -- Centro de Custos com resumo, tabela e dialogs"
```

---

### Task 8: Nav, dashboard-link e verificação final

**Files:**

- Modify: `apps/web/src/components/shell/nav-items.ts`

**Interfaces:**

- Consumes: página `/costs` (Task 7).
- Produces: seção "Financeiro" no menu.

- [ ] **Step 1: Nav** — em `NAV_SECTIONS`, nova seção entre "Fechamento" e "Prospecção":

```ts
{
  title: "Financeiro",
  items: [
    { label: "Centro de Custos", href: "/costs", icon: Wallet, permission: "proposals:read" },
  ],
},
```

(import `Wallet` de `lucide-react`.)

- [ ] **Step 2: Suíte completa local**

Run: `pnpm turbo format:check lint type-check build` (mesmos steps do CI) e `pnpm --filter @millead/api exec vitest run`
Expected: tudo PASS. Corrigir o que quebrar antes de seguir.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/shell/nav-items.ts
git commit -m "feat(web): seção Financeiro no menu com Centro de Custos"
```

- [ ] **Step 4: Checkpoint com o Rick (NÃO automatizar)** — mostrar a página local funcionando (screenshot) e pedir OK pra: merge na `main`, `pnpm db:migrate:deploy` + `pnpm db:seed` contra produção e push (Render + Vercel fazem deploy automático). Deploy em produção é ação de produção — só com aprovação explícita.

---

## Self-review do plano (feito na escrita)

- **Cobertura da spec (Fase 1):** models ✓ (Task 1), RLS ✓ (Task 1 Step 3), seed com valores reais do Rick + catálogo + produtos ✓ (Task 2), API `/costs` completa ✓ (Tasks 3–5), rateio ✓ (Task 4), página `/costs` com editabilidade total ✓ (Task 7), nav ✓ (Task 8). Capacidade: campos no schema/tabela ✓; barras/alertas ficam na Fase 4 (spec).
- **Placeholders:** nenhum TBD; pontos onde o executor precisa conferir convenção local estão marcados com a instrução exata de onde olhar (classe de erro 404, formato do `PERMISSIONS`, `api.delete`).
- **Consistência de tipos:** `CostSummary` idêntico em `entities/cost.ts` (API) e `types/api.ts` (web); decimais string no wire, number nos payloads de escrita; nomes de hooks/serviços iguais entre Tasks 6 e 7.
