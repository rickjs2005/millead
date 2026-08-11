# Contas a receber — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Contrato assinado ganha plano de recebimento (entrada + parcelas), baixa manual quando o dinheiro cai, e visão de a receber/vencidas/margem realizada.

**Architecture:** Módulo org-scoped no molde exato do Centro de Custos (Prisma → domain → application → interfaces na API; feature folder + service + telas no web). Margem realizada percorre a cadeia já existente `Contract.proposalId → PricingEstimate (findByProposalId) → computeEstimate().totalCost`. "Vencida" é derivado (`paidAt null && dueDate < hoje`), sem job.

**Tech Stack:** Express + Prisma + zod + vitest (API); Next.js + React Query + react-hook-form + zodResolver (web) — tudo já no repo.

**Spec:** `docs/superpowers/specs/2026-08-02-contas-a-receber-design.md`
**Correções da spec (valem sobre o texto dela):** (1) dinheiro NÃO é cents Int — convenção do repo é `Decimal @db.Decimal(12,2)` no schema, `string` na entidade, `z.number()` no DTO de entrada (zero ocorrências de "cents" no repo). Campos renomeados de `amountCents/entryCents/totalCents` para `amount/entryAmount/total` (number no DTO). (2) A entidade `Contract` e o `baseSelect` do repositório não expõem `proposalId` (existe só no schema) — adicionar é pré-requisito da margem. (3) O custo projetado do orçamento é recalculado on-the-fly (itens congelados + câmbio ATUAL das settings) — aceito e documentado: a variação vem só do câmbio USD de itens de custo em dólar.

## Global Constraints

- Tabelas org-scoped com `organizationId` direto + relation em `model Organization` (convenção do schema, comentário nas linhas 1-16).
- Dinheiro `Decimal(12,2)`; entidade serializa `.toString()`; DTO de entrada `z.number().min(0).max(9_999_999)` (padrão `money` do estimate.dto).
- Permissões: reusar `PERMISSIONS.PROPOSALS_READ/WRITE` (mesmo atalho documentado de custos/contratos — sem re-seed).
- Validação do plano: entrada + Σ parcelas = total; centavo de ajuste na ÚLTIMA parcela; 409 pra plano quando já existe parcela paga; 409 baixa dupla; editar/excluir só parcela em aberto; 404 cross-org (padrão).
- "Vencida" derivada, nunca materializada.
- Comandos pnpm; commits `feat(db|api|web):`; imports ESM `.js` na API; pt-BR em UI/comentários.
- Suite atual: 200 testes — nada pode quebrar.

---

## Estrutura de arquivos

```
packages/database/prisma/schema.prisma                       (modify: Receivable + enum + relations)
apps/api/src/
  domain/entities/receivable.ts                              (create)
  domain/entities/contract.ts                                (modify: proposalId)
  domain/repositories/receivable-repository.ts               (create)
  domain/repositories/contract-repository.ts                 (modify: kpis? não — nada)
  application/services/receivable-plan.ts (+test)            (create — builder puro)
  application/services/receivable-service.ts (+test)         (create)
  application/dto/receivable.dto.ts (+test)                  (create)
  infrastructure/prisma/prisma-receivable-repository.ts      (create)
  infrastructure/prisma/prisma-contract-repository.ts        (modify: proposalId no baseSelect/toDomain)
  application/services/estimate-service.ts                   (modify: método público projectedCost)
  interfaces/http/controllers/receivable-controller.ts       (create)
  interfaces/http/routes/receivable-routes.ts                (create)
  main/container.ts + main/app.ts                            (modify: wiring + mount /api/v1/receivables)
apps/web/src/
  types/api.ts                                               (modify)
  services/receivables.ts                                    (create)
  lib/query-keys.ts                                          (modify)
  features/receivables/hooks.ts                              (create)
  features/receivables/components/plan-dialog.tsx            (create)
  features/receivables/components/installments-card.tsx      (create — seção do contrato)
  app/(app)/contracts/[id]/page.tsx                          (modify: monta o card)
  app/(app)/receivables/page.tsx                             (create)
  features/dashboard/components/finance-cards.tsx            (modify: card "A receber")
  components/shell/nav-items.ts                              (modify: item "A Receber")
  middleware.ts                                              (modify: "/receivables" em APP_PREFIXES)
```

---

### Task 1: Schema — Receivable

**Files:**

- Modify: `packages/database/prisma/schema.prisma`

**Interfaces:**

- Produces: model `Receivable`, enum `ReceivableKind { ENTRADA, PARCELA }`, relations `Organization.receivables` e `Contract.receivables`.

- [ ] **Step 1:** Adicionar no schema (junto dos models de contrato):

```prisma
enum ReceivableKind {
  ENTRADA
  PARCELA

  @@map("receivable_kind")
}

/// Parcela do plano de recebimento de um contrato. "Vencida" e derivado
/// (paidAt null && dueDate < hoje) -- nunca materializado.
model Receivable {
  id               String         @id @default(cuid())
  organizationId   String         @map("organization_id")
  contractId       String         @map("contract_id")
  kind             ReceivableKind
  installmentIndex Int            @map("installment_index")
  amount           Decimal        @db.Decimal(12, 2)
  dueDate          DateTime       @map("due_date")
  paidAt           DateTime?      @map("paid_at")
  paidNote         String?        @map("paid_note")
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contract     Contract     @relation(fields: [contractId], references: [id], onDelete: Cascade)

  @@unique([contractId, installmentIndex])
  @@index([organizationId, dueDate])
  @@map("receivables")
}
```

E as back-relations: `receivables Receivable[]` em `model Organization` (lista de relations) E em `model Contract`.

- [ ] **Step 2:** Migration: `pnpm --filter @millead/database migrate -- --name add_contract_receivables`. Fallback conhecido do pooler: SQL manual no diretório `20260802152000_add_contract_receivables/` (CREATE TYPE + CREATE TABLE com FKs cascade + unique (contract_id, installment_index) + index (organization_id, due_date)) + `pnpm --filter @millead/database generate`.
- [ ] **Step 3:** Verificar client (grep `Receivable` no generated) e commit:

```bash
git add packages/database/prisma
git commit -m "feat(db): parcelas de recebimento por contrato (Receivable)"
```

---

### Task 2: Builder puro do plano + entidades + interface do repositório

**Files:**

- Create: `apps/api/src/domain/entities/receivable.ts`
- Create: `apps/api/src/application/services/receivable-plan.ts`
- Test: `apps/api/src/application/services/receivable-plan.test.ts`
- Create: `apps/api/src/domain/repositories/receivable-repository.ts`

**Interfaces:**

- Produces:

```ts
// entities/receivable.ts
export type ReceivableKind = "ENTRADA" | "PARCELA";
export interface Receivable {
  id: string;
  organizationId: string;
  contractId: string;
  kind: ReceivableKind;
  installmentIndex: number; // 0 = entrada, 1..N = parcelas
  amount: string; // Decimal serializa como string
  dueDate: Date;
  paidAt: Date | null;
  paidNote: string | null;
}

// receivable-plan.ts — funcao PURA, sem I/O
export interface PlanInput {
  total: number; // valor total do contrato (reais)
  entryAmount: number; // entrada em reais (0 = sem entrada)
  installmentCount: number; // N parcelas alem da entrada (>= 1 se entryAmount < total)
  firstDueDate: Date; // vencimento da 1a parcela
  entryDueDate: Date; // vencimento da entrada
}
export interface PlanItem {
  kind: ReceivableKind;
  installmentIndex: number;
  amount: number;
  dueDate: Date;
}
/** Distribui (total - entrada) em N parcelas iguais com 2 casas; o resto
 *  de centavos vai na ULTIMA parcela. Vencimentos mensais a partir de
 *  firstDueDate (mesmo dia; meses curtos usam o ultimo dia do mes).
 *  Lanca RangeError se entrada > total, N < 0, total <= 0, ou
 *  (entrada < total && N < 1). entryAmount 0 nao gera item ENTRADA. */
export function buildPlan(input: PlanInput): PlanItem[];

// repositories/receivable-repository.ts
export interface CreatePlanItem {
  kind: ReceivableKind;
  installmentIndex: number;
  amount: string;
  dueDate: Date;
}
export interface ReceivableRepository {
  /** Cria o plano numa transacao. Retorna null se o contrato ja tem QUALQUER parcela (plano existente). */
  createPlan(
    organizationId: string,
    contractId: string,
    items: CreatePlanItem[],
  ): Promise<Receivable[] | null>;
  listByContract(organizationId: string, contractId: string): Promise<Receivable[]>;
  findById(organizationId: string, id: string): Promise<Receivable | null>;
  /** CAS: marca paga so se paidAt null. Retorna null se ja paga/inexistente. */
  markPaid(
    organizationId: string,
    id: string,
    paidAt: Date,
    paidNote: string | null,
  ): Promise<Receivable | null>;
  /** CAS inverso: desfaz baixa so se paidAt nao-null. */
  markUnpaid(organizationId: string, id: string): Promise<Receivable | null>;
  /** So parcela em aberto. Retorna null se paga/inexistente. */
  update(
    organizationId: string,
    id: string,
    patch: { amount?: string; dueDate?: Date },
  ): Promise<Receivable | null>;
  /** So parcela em aberto. False se paga/inexistente. */
  delete(organizationId: string, id: string): Promise<boolean>;
  hasPaid(organizationId: string, contractId: string): Promise<boolean>;
  deleteOpenByContract(organizationId: string, contractId: string): Promise<number>;
  /** Todas as parcelas da org no intervalo [from, to) por dueDate + todas em aberto vencidas antes de from. */
  listForSummary(organizationId: string, from: Date, to: Date): Promise<Receivable[]>;
  /** Agregado por contrato: soma paga (para margem). */
  sumPaidByContract(organizationId: string, contractId: string): Promise<string>;
  /** Contratos da org que tem parcelas, com totais (pago/total/aberto) — alimenta a listagem. */
  listContractsWithTotals(organizationId: string): Promise<
    Array<{
      contractId: string;
      numero: string;
      companyName: string;
      total: string;
      paid: string;
      openOverdue: string;
      nextDueDate: Date | null;
    }>
  >;
}
```

- [ ] **Step 1 (TDD):** `receivable-plan.test.ts` — casos: total 1000, entrada 400, 3x → parcelas 200/200/200; total 1000, entrada 0, 3x → 333.33/333.33/333.34 (ajuste na última); soma sempre === total (property em 4-5 combinações incluindo dízimas); mensalidade: firstDueDate 31/01 → parcelas 31/01, 28/02 (ou 29), 31/03; RangeError pra entrada>total, N<1 com resto, total<=0; entrada === total com N=0 → só item ENTRADA.
- [ ] **Step 2:** Ver falhar → implementar `buildPlan` (arredondar cada parcela com `Math.floor(x*100)/100` e jogar `total - entrada - soma` na última; meses via `setMonth` com clamp de dia) → ver passar.
- [ ] **Step 3:** Criar entidade e interface do repo (verbatim acima). Typecheck. Commit `feat(api): builder puro do plano de parcelas e contrato do repositorio`.

---

### Task 3: Repositório Prisma + proposalId no Contract

**Files:**

- Create: `apps/api/src/infrastructure/prisma/prisma-receivable-repository.ts`
- Modify: `apps/api/src/domain/entities/contract.ts` (adicionar `proposalId: string | null`)
- Modify: `apps/api/src/infrastructure/prisma/prisma-contract-repository.ts` (proposalId no `baseSelect` e no `toDomain`)

**Interfaces:**

- Consumes: interface da Task 2; client Prisma (import padrão do prisma-cost-repository).
- Produces: `PrismaReceivableRepository`; `Contract.proposalId` disponível pra Task 4.

- [ ] **Step 1:** Implementar o repo. Pontos não-óbvios:
  - `createPlan`: `prisma.$transaction` — primeiro `count where contractId` (>0 → return null), depois `createMany` + `findMany` ordenado por installmentIndex.
  - `markPaid`/`markUnpaid`/`update`/`delete`: `updateMany`/`deleteMany` condicionados (`paidAt: null` ou `paidAt: { not: null }`) + releitura — padrão CAS do repo (count 0 → null/false).
  - `listForSummary`: `where: { organizationId, OR: [{ dueDate: { gte: from, lt: to } }, { paidAt: null, dueDate: { lt: from } }] }`.
  - `sumPaidByContract`: `aggregate _sum.amount where paidAt not null` → `.toString()` (null → "0").
  - `listContractsWithTotals`: groupBy contractId com _sum; depois um findMany de contratos (numero + company.name via include) — 2 queries, sem N+1.
  - Conversão Decimal→string em TODA leitura (`amount: row.amount.toString()`).
- [ ] **Step 2:** `proposalId` no contract: entidade + `baseSelect` + `toDomain` (3 linhas).
- [ ] **Step 3:** `pnpm --filter @millead/api exec tsc --noEmit` limpo + suite (200) verde. Commit `feat(api): repositorio Prisma de parcelas e proposalId exposto no contrato`.

---

### Task 4: DTOs + ReceivableService (com testes) + projectedCost no EstimateService

**Files:**

- Create: `apps/api/src/application/dto/receivable.dto.ts` (+ `.test.ts`)
- Create: `apps/api/src/application/services/receivable-service.ts` (+ `.test.ts`)
- Modify: `apps/api/src/application/services/estimate-service.ts`

**Interfaces:**

- Consumes: Task 2/3; `EstimateRepository.findByProposalId(proposalId)` (existe); `computeEstimate` + `CostRepository.getSettings` (padrão `withComputed` privado do estimate-service).
- Produces (Task 5 usa):

```ts
// dto — padrão money do estimate.dto: z.number().min(0).max(9_999_999)
export const createPlanSchema = z.object({
  contractId: z.string().min(1),
  total: money.positive(),
  entryAmount: money,                      // 0 = sem entrada
  entryDueDate: z.coerce.date(),
  installments: z.array(z.object({ amount: money.positive(), dueDate: z.coerce.date() })).max(60),
});                                        // valida soma no SERVICE (mensagem com a diferenca), nao no zod
export const paySchema = z.object({ paidAt: z.coerce.date().optional(), paidNote: z.string().max(500).optional() });
export const updateReceivableSchema = z.object({ amount: money.positive().optional(), dueDate: z.coerce.date().optional() });
export const receivableQuerySchema = z.object({ contractId: z.string().min(1).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional() });

// service
export interface ReceivableSummary {
  month: string;
  toReceive: string;      // em aberto com vencimento no mes
  overdue: string;        // em aberto vencidas (qualquer data passada)
  overdueItems: Receivable[];
  received: string;       // pagas com paidAt no mes
}
export interface ContractMargin {
  contractId: string;
  soldValue: string;              // contract.valorTotal
  received: string;               // soma paga
  projectedCost: string | null;   // null se contrato sem proposalId/orcamento
  realizedMargin: string | null;  // received - projectedCost (null se sem custo)
}

class ReceivableService {
  createPlan(organizationId: string, input: CreatePlanInput): Promise<Receivable[]>;   // 422 soma != total (diferenca na msg); 409 ja tem parcela paga; recriar = deleteOpenByContract antes quando nao ha paga; 404 contrato de outra org
  listByContract(organizationId: string, contractId: string): Promise<Receivable[]>;
  pay(organizationId: string, id: string, input: PayInput): Promise<Receivable>;       // 409 ja paga
  unpay(organizationId: string, id: string): Promise<Receivable>;                      // 409 nao paga
  update(organizationId: string, id: string, patch: UpdateInput): Promise<Receivable>; // 409 paga
  remove(organizationId: string, id: string): Promise<void>;                           // 409 paga
  summary(organizationId: string, month?: string): Promise<ReceivableSummary>;         // default mes atual (America/Sao_Paulo)
  listContracts(organizationId: string): Promise<ContractWithTotals[]>;
  margin(organizationId: string, contractId: string): Promise<ContractMargin>;
}

// estimate-service.ts — método público novo:
/** Custo total projetado do orcamento vinculado a proposta (cadeia
 *  contrato.proposalId -> orcamento). Recalculado com o cambio atual --
 *  itens estao congelados, so o USD varia. Null se nao ha orcamento. */
async projectedCostByProposalId(organizationId: string, proposalId: string): Promise<number | null>
// implementacao: findByProposalId -> se null ou organizationId diferente -> null;
// senao toComputed(estimate, usdRate).totalCost (reusa o privado)
```

- [ ] **Step 1 (TDD DTO):** aceita plano válido; rejeita installments vazio com entrada < total? (não — a validação de composição é do service; o zod só valida shapes: amount positivo, month regex, max 60).
- [ ] **Step 2 (TDD service):** mocks in-memory. Casos obrigatórios: criar plano válido (soma confere, itens com index 0=entrada quando entryAmount>0, 1..N); soma errada → ValidationError com a diferença; contrato de outra org → NotFoundError; já tem paga → ConflictError; recriar sem paga → deleteOpenByContract chamado e plano novo criado; pay ok + 409 dupla; unpay ok + 409 não-paga; update/remove só em aberto (409 paga); summary: em aberto no mês vs vencida antiga vs paga no mês (3 parcelas, uma de cada) e default do mês atual; margin com orçamento (projectedCost e realizedMargin calculados), sem proposalId (nulls), contrato de outra org → 404.
- [ ] **Step 3:** Implementar (service valida composição com tolerância de 0.01; `summary` calcula fronteiras do mês em America/Sao_Paulo — usar o padrão de data que o cost-service/usage já usa pra mês, grep `month` lá e seguir). `projectedCostByProposalId` no estimate-service reusa `toComputed` privado.
- [ ] **Step 4:** Suite inteira + tsc. Commit `feat(api): ReceivableService com plano, baixa, resumo e margem realizada`.

---

### Task 5: Controller + rotas + wiring

**Files:**

- Create: `apps/api/src/interfaces/http/controllers/receivable-controller.ts`
- Create: `apps/api/src/interfaces/http/routes/receivable-routes.ts`
- Modify: `apps/api/src/main/container.ts`, `apps/api/src/main/app.ts`

**Interfaces:**

- Consumes: `ReceivableService` (Task 4); `requirePermission(PERMISSIONS.PROPOSALS_READ/WRITE)`; `validateBody/validateQuery`; `asyncHandler`; padrão exato do cost-routes.
- Produces: montado em `/api/v1/receivables`:
  - `POST /plan` (write, validateBody(createPlanSchema))
  - `GET /` (read, validateQuery(receivableQuerySchema) — com contractId lista parcelas; sem, 400? NÃO: sem contractId → listContracts com totais)
  - `GET /summary` (read, validateQuery month opcional)
  - `GET /margin` (read, validateQuery contractId obrigatório — reaproveitar schema com refine)
  - `PATCH /:id/pay` (write, validateBody(paySchema)); `PATCH /:id/unpay` (write); `PATCH /:id` (write, validateBody(updateReceivableSchema)); `DELETE /:id` (write)

- [ ] **Step 1:** Controller thin (auth = requireAuth(req), organizationId do contexto — molde CostController).
- [ ] **Step 2:** Rotas no molde createCostRoutes (router.use(authenticate); read/write por rota).
- [ ] **Step 3:** Wiring: `PrismaReceivableRepository` → `ReceivableService(receivableRepo, contractRepository, estimateService)` — ATENÇÃO à ordem de declaração no container (estimateService já é criado antes; declarar receivableService depois dele). Mount em app.ts junto dos outros.
- [ ] **Step 4:** Boot local + curl 401 sem token; suite + tsc + lint. Commit `feat(api): rotas /receivables com permissoes de proposals`.

---

### Task 6: Web — services, hooks, nav e seção Recebimento no contrato

**Files:**

- Modify: `apps/web/src/types/api.ts` (Receivable, ReceivableSummary, ContractMargin, ContractWithTotals — datas como string, valores como string)
- Create: `apps/web/src/services/receivables.ts`
- Modify: `apps/web/src/lib/query-keys.ts` (`queryKeys.receivables.*`)
- Create: `apps/web/src/features/receivables/hooks.ts`
- Create: `apps/web/src/features/receivables/components/plan-dialog.tsx`
- Create: `apps/web/src/features/receivables/components/installments-card.tsx`
- Modify: `apps/web/src/app/(app)/contracts/[id]/page.tsx`
- Modify: `apps/web/src/components/shell/nav-items.ts` + `apps/web/src/middleware.ts`

**Interfaces:**

- Consumes: endpoints da Task 5; padrão de dialog `cost-subscription-dialog.tsx` (react-hook-form + zodResolver, Controller pra Select, toasts nos hooks); `useConfirmDialog` do detalhe do contrato; `formatCurrency` de `@/utils/format`.

- [ ] **Step 1:** Types + service wrapper (`receivablesService = { createPlan, listByContract(contractId), listContracts(), summary(month?), margin(contractId), pay(id, payload), unpay(id), update(id, payload), remove(id) }`) + query-keys + hooks (mutations invalidam `queryKeys.receivables.all` E `queryKeys.contracts.detail(contractId)` quando aplicável; toasts de sucesso/erro no padrão contracts/hooks.ts).
- [ ] **Step 2:** `plan-dialog.tsx`: form com total (prefill `contract.valorTotal`), entrada (R$ — campo único; % fica pro usuário calcular, YAGNI), vencimento da entrada, nº de parcelas (1-60), 1º vencimento; PREVIEW da distribuição (usa uma cópia local de `buildPlan` simplificada OU monta os installments no submit: dividir igual + resto na última — mesma regra da API, comentário apontando pro espelho); lista editável de vencimentos/valores antes de salvar (opcional simples: mostrar preview em tabela readonly e enviar — edição fina fica na tabela pós-criação via PATCH). Submit → `createPlan` com installments explícitos.
- [ ] **Step 3:** `installments-card.tsx`: Card "Recebimento" — sem plano: estado vazio + botão "Definir plano" (dialog); com plano: tabela (parcela, vencimento, valor, status: Paga verde/Vencida vermelha/Em aberto neutra — derivada no front, badge) + ações por linha (baixa com note opcional via prompt/dialog pequeno, desfazer, editar valor/vencimento em aberto, excluir em aberto com confirm) + rodapé com progresso (pago/total). Margem: quando `contract.proposalId` existir, buscar `margin(contractId)` e mostrar linha "Margem realizada: R$X (custo projetado R$Y)".
- [ ] **Step 4:** Montar o card na coluna direita do detalhe do contrato (embaixo de "Linha do tempo"); visível pra qualquer status mas com aviso quando não-ASSINADO ("contrato ainda não assinado" em texto leve — spec permite definir antes).
- [ ] **Step 5:** Nav: `{ label: "A Receber", href: "/receivables", icon: HandCoins, permission: "proposals:read" }` na seção Financeiro (import lucide em ordem alfabética; conferir que HandCoins existe na versão — fallback Banknote). Middleware: `/receivables` em APP_PREFIXES.
- [ ] **Step 6:** tsc + lint web. Commit `feat(web): plano de recebimento e baixa de parcelas no contrato`.

---

### Task 7: Web — página /receivables + card no dashboard

**Files:**

- Create: `apps/web/src/app/(app)/receivables/page.tsx`
- Modify: `apps/web/src/features/dashboard/components/finance-cards.tsx`

**Interfaces:**

- Consumes: hooks da Task 6 (`useReceivablesSummary`, `useReceivableContracts`, `useContractMargin` sob demanda); `StatCard` (`features/dashboard/components/stat-card.tsx`).

- [ ] **Step 1:** Página: header com seletor de mês (input month, default atual); 3 StatCards (A receber no mês / Vencidas [accent destructive quando >0] / Recebido no mês); tabela "Vencidas" em destaque quando houver (contrato, parcela, vencimento, valor, botão baixa); tabela "Por contrato" (numero + empresa, progresso pago/total, próxima parcela, link pro detalhe). Estado vazio: "Nenhum plano de recebimento ainda — defina no detalhe de um contrato assinado."
- [ ] **Step 2:** Dashboard: adicionar StatCard "A receber" em `finance-cards.tsx` usando `receivablesService.summary()` (query própria, gated pela mesma permissão) — valor = toReceive + overdue, `accent="warning"` se overdue > 0; label mostra "(X vencidas)" quando houver.
- [ ] **Step 3:** Verificação visual: dev server, `/receivables` renderiza estado vazio sem erro (API local ok — dados reais só pós-uso). tsc + lint. Commit `feat(web): pagina A Receber e card no dashboard`.

---

### Task 8: Validação final

- [ ] **Step 1:** Suites completas: `pnpm --filter @millead/api test -- run` + tsc + lint (api e web).
- [ ] **Step 2:** Smoke local sem tocar dados de produção: boot API+web; GET /api/v1/receivables sem auth → 401; página /receivables logado (se seed local disponível; senão registrar limitação no relatório).
- [ ] **Step 3:** Fixes se necessário (`fix(api|web): ajustes do smoke do contas a receber`); relatório.

---

## Self-review (feito na escrita)

- **Cobertura da spec:** modelo (T1, Decimal em vez de cents — correção documentada), builder+regras de plano (T2/T4), CAS de baixa/desfazer/editar/excluir (T3/T4), summary por mês + vencidas derivadas (T4), margem via proposalId→estimate→totalCost com null pra contrato sem vínculo (T3 proposalId + T4 projectedCost), rotas com permissões reusadas (T5), UI contrato + página + dashboard + nav (T6/T7), erros 409/422/404 (T4/T5). ✓
- **Placeholders:** nenhum TBD; T6 Step 2 simplifica edição fina pro pós-criação (decisão YAGNI explícita, não placeholder). ✓
- **Consistência:** `buildPlan`/`PlanItem` (T2) → usados em T4; nomes de endpoints T5 = service wrapper T6; `Receivable.amount: string` consistente API↔web; `projectedCostByProposalId` (T4) consumido no `margin`. ✓
