# Aceite público de proposta + contrato herdado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cliente aceita/recusa proposta por link público `/p/:token`; o aceite cria contrato em rascunho com valores herdados e notifica o dono.

**Architecture:** Segue os moldes já existentes no repo: token público e rotas públicas no padrão do briefing (`/b/:token`), página pública no padrão do `/fechamento`, transição atômica no padrão do `markCompleted` do briefing, notificação no padrão do briefing-completion (push síncrono best-effort + e-mail pro OWNER_EMAIL). Vínculo novo `Contract.proposalId` (unique) e criação de rascunho SEM enfileirar o worker de PDF/assinatura.

**Tech Stack:** Express + Prisma + zod + vitest (API); Next.js App Router + React Query (web); express-rate-limit (já usado).

**Spec:** `docs/superpowers/specs/2026-08-02-aceite-publico-contrato-herdado-design.md`
**Correções da spec descobertas na exploração (valem sobre o texto da spec):** Proposal NÃO tem `estimateId` — o orçamento aponta pra proposta (`PricingEstimate.proposalId @unique`, back-relation `proposal.pricingEstimate`); Proposal NÃO tem `companyId` — empresa vem de `lead.companyId`, e `Contract.companyId` é NOT NULL, então a herança usa a empresa do lead e, se não houver empresa ou documento, a criação do contrato falha de forma controlada (aceite fica de pé, notificação avisa).

## Global Constraints

- Aceite/recusa/VIEWED são transições ATÔMICAS (updateMany condicional no status, padrão `markCompleted` de `prisma-briefing-repository.ts:195`).
- Aceite repetido da MESMA decisão retorna 200 com estado atual (idempotente); decisão conflitante → 409; expirada → 410 e marca EXPIRED.
- Token: 20 chars do alfabeto de 32 (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, ≈100 bits), mesmo gerador do briefing; 404 uniforme pra token inexistente E proposta DRAFT.
- Falha na criação do contrato herdado NÃO desfaz o aceite; a notificação menciona a falha.
- O contrato herdado nasce RASCUNHO e NÃO entra na fila (`queue.enqueue` NÃO é chamado — o `create()` atual sempre enfileira, por isso o caminho novo é separado).
- Notificações são best-effort (nunca derrubam o fluxo): push `void ... .catch(() => null)`, e-mail com erro engolido e logado.
- Marcação manual de ACCEPTED/REJECTED não sobrescreve decisão pública (409).
- Textos de UI/erros pt-BR; comentários pt-BR; imports ESM `.js` na API.
- Comandos com pnpm; testes `pnpm --filter @millead/api test -- run <arquivo>`.
- Commits: `feat(db):`/`feat(api):`/`feat(web):` como no log.

---

## Estrutura de arquivos

```
packages/database/prisma/schema.prisma                     (modify: Proposal + Contract)
apps/api/src/
  application/services/public-token.ts                     (create — gerador compartilhado)
  application/services/briefing-service.ts                 (modify: importar o gerador)
  application/services/proposal-service.ts                 (modify: token no SENT, e-mail com link, guarda manual)
  application/services/proposal-public-service.ts (+test)  (create — get/accept/reject público)
  application/services/contract-service.ts                 (modify: createDraftFromProposal)
  application/services/contract-service.test.ts            (create ou modify se existir)
  application/dto/proposal.dto.ts                          (modify: rejectPublicSchema)
  domain/entities/proposal.ts                              (modify: campos novos)
  domain/repositories/proposal-repository.ts               (modify: métodos atômicos)
  domain/repositories/contract-repository.ts               (modify: proposalId no input + findByProposalId)
  domain/services/proposal-notifier.ts                     (modify: propostaDecidida)
  infrastructure/proposals/proposal-notifier.ts            (modify: impl + link público no e-mail)
  infrastructure/prisma/prisma-proposal-repository.ts      (modify)
  infrastructure/prisma/prisma-contract-repository.ts      (modify)
  interfaces/http/controllers/proposal-controller.ts       (modify: handlers públicos)
  interfaces/http/routes/proposal-routes.ts                (modify: createPublicProposalRoutes)
  main/app.ts + main/container.ts                          (modify: mount + wiring)
apps/web/src/
  services/proposals-public.ts                             (create)
  app/p/[token]/page.tsx                                   (create — página pública)
  features/proposals/public-link-card.tsx                  (create — bloco interno)
  (tela de detalhe de proposta existente)                  (modify: usar o card + link contrato)
  types/api.ts                                             (modify: campos novos)
```

---

### Task 1: Schema — campos públicos na Proposal + vínculo no Contract

**Files:**

- Modify: `packages/database/prisma/schema.prisma` (models Proposal ~linha 624 e Contract ~linha 854)

**Interfaces:**

- Produces: campos `Proposal.publicToken/viewedAt/decidedAt/decisionIp/rejectReason`; `Contract.proposalId String? @unique` + relations dos dois lados.

- [ ] **Step 1: Editar o model Proposal** — adicionar após `respondedAt`:

```prisma
  // ===== Aceite público (/p/:token) =====
  publicToken  String?   @unique @map("public_token")
  viewedAt     DateTime? @map("viewed_at")
  decidedAt    DateTime? @map("decided_at")
  decisionIp   String?   @map("decision_ip")
  rejectReason String?   @map("reject_reason") @db.Text
```

E na lista de relations da Proposal: `contract Contract?` (back-relation).

- [ ] **Step 2: Editar o model Contract** — adicionar após `leadId`:

```prisma
  /// Proposta aceita que originou este contrato (unique: 1 proposta -> no
  /// maximo 1 contrato). Null em contratos criados direto/formulario publico.
  proposalId String? @unique @map("proposal_id")
```

E na lista de relations do Contract: `proposal Proposal? @relation(fields: [proposalId], references: [id], onDelete: SetNull)`.

- [ ] **Step 3: Migration**

Run: `pnpm --filter @millead/database migrate -- --name add_proposal_public_accept`
Se o `migrate dev` falhar por timeout do pooler (aconteceu no MilSocial): criar o SQL manualmente no diretório `packages/database/prisma/migrations/<timestamp>_add_proposal_public_accept/` (ALTER TABLE proposals ADD COLUMN public_token TEXT, viewed_at/decided_at TIMESTAMP(3), decision_ip TEXT, reject_reason TEXT; CREATE UNIQUE INDEX em public_token; ALTER TABLE contracts ADD COLUMN proposal_id TEXT; unique index + FK ON DELETE SET NULL) e rodar `pnpm --filter @millead/database generate`. Anotar no relatório.

- [ ] **Step 4: Verificar client** — grep `publicToken` no client gerado (`packages/database/src/generated/client`).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma
git commit -m "feat(db): campos de aceite publico na proposta e vinculo proposta-contrato"
```

---

### Task 2: Gerador de token compartilhado + token no SENT + e-mail com link

**Files:**

- Create: `apps/api/src/application/services/public-token.ts`
- Modify: `apps/api/src/application/services/briefing-service.ts:19-35` (importar em vez da cópia local)
- Modify: `apps/api/src/domain/entities/proposal.ts`, `apps/api/src/domain/repositories/proposal-repository.ts`, `apps/api/src/infrastructure/prisma/prisma-proposal-repository.ts` (campos novos + `UpdateProposalInput.publicToken`)
- Modify: `apps/api/src/application/services/proposal-service.ts` (gerar token na transição pra SENT; guarda contra sobrescrever decisão pública)
- Modify: `apps/api/src/domain/services/proposal-notifier.ts` + `apps/api/src/infrastructure/proposals/proposal-notifier.ts` (e-mail de envio ganha `publicUrl`)

**Interfaces:**

- Consumes: `generatePublicToken` extraído de `briefing-service.ts:19-35` (código idêntico, alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, length 20, `randomInt` de `node:crypto`).
- Produces: `generatePublicToken(length = 20): string` exportado de `public-token.ts`; entidade `Proposal` com `publicToken/viewedAt/decidedAt/decisionIp/rejectReason` (todos `| null`); `ProposalNotifier.propostaEnviada` ganha campo `publicUrl: string | null` no input.

- [ ] **Step 1: Criar `public-token.ts`** — mover a função e o alfabeto do briefing-service (verbatim, com o mesmo comentário); exportar ambos.

- [ ] **Step 2: `briefing-service.ts`** — remover a cópia local, importar de `./public-token.js`. Rodar `pnpm --filter @millead/api test -- run brief` (testes de briefing seguem verdes).

- [ ] **Step 3: Entidade/repo/impl** — adicionar os 5 campos na entidade (mapeando null), no `UpdateProposalInput` (`publicToken?: string`) e no mapper do prisma-proposal-repository.

- [ ] **Step 4: `proposal-service.update`** — na transição pra SENT (bloco existente linha ~40):

```ts
if (patch.status === "SENT") {
  // Token do link publico: gerado uma vez, reenvio nao invalida o link.
  if (!proposal.publicToken) {
    resolvedPatch não serve mais aqui — buscar antes: const current = await this.repository.findById(id, organizationId);
  }
}
```

Implementação concreta: ANTES do `repository.update`, se `patch.status === "SENT"`, buscar a proposta atual (`findById` já existe no repo — conferir nome exato) e, se `publicToken` null, incluir `publicToken: generatePublicToken()` no `resolvedPatch` (com retry de unicidade: try/catch no update pra colisão de unique → gerar de novo, 1 retry basta com 100 bits).
No mesmo método: se `patch.status` é ACCEPTED/REJECTED **manual** e a proposta atual já tem `decidedAt` preenchido → `ConflictError("Esta proposta já foi decidida pelo cliente pelo link público.")`.

- [ ] **Step 5: E-mail com link** — `propostaEnviada` ganha `publicUrl` (montado no service: `` `${env.WEB_PUBLIC_URL}/p/${token}` `` — env já existe, usado pro briefing); o HTML do e-mail ganha botão/link "Ver e aceitar a proposta" apontando pro `publicUrl` (mantém o link do PDF). Passar `publicUrl: null` se sem token (não acontece no fluxo, mas o tipo permite).

- [ ] **Step 6: Testes** — `pnpm --filter @millead/api test -- run` (suite inteira verde; testes de proposal-service, se existirem, ajustados). Typecheck limpo.

- [ ] **Step 7: Commit**

```bash
git add -A apps/api/src packages 2>/dev/null; git commit -m "feat(api): token publico gerado no envio da proposta e link no e-mail"
```

---

### Task 3: Herança proposta → contrato (createDraftFromProposal)

**Files:**

- Modify: `apps/api/src/application/services/contract-service.ts`
- Modify: `apps/api/src/domain/repositories/contract-repository.ts` (`CreateContractInput.proposalId?: string`; `findByProposalId(proposalId): Promise<Contract | null>`)
- Modify: `apps/api/src/infrastructure/prisma/prisma-contract-repository.ts`
- Test: `apps/api/src/application/services/contract-draft.test.ts`

**Interfaces:**

- Consumes: `Proposal` (entidade com campos novos), `proposal.pricingEstimate` — ATENÇÃO: a entidade Proposal pode não expor o estimate; o método recebe os dados já resolvidos (ver assinatura) pra não acoplar repositórios.
- Produces (Task 4 chama):

```ts
export interface DraftFromProposalInput {
  proposal: Proposal;                       // entidade, com organizationId/leadId/value/title
  estimate: {                               // do pricingEstimate da proposta, ou null
    scopeItems: string[];
    deadlineDays: number;
  } | null;
  company: { id: string; name: string; document: string | null; email: string | null; phone: string | null } | null; // empresa do lead
  contact: { name: string; email: string | null; phone: string | null } | null;   // contato principal do lead
}

/** Cria contrato RASCUNHO herdado da proposta aceita. NAO enfileira o worker
 *  (PDF/assinatura ficam pra quando o dono revisar e disparar). Lança
 *  ValidationError se faltar dado obrigatorio (empresa sem documento, sem
 *  empresa) -- o chamador trata como best-effort. */
async createDraftFromProposal(input: DraftFromProposalInput): Promise<Contract>
```

- [ ] **Step 1: Testes primeiro** (`contract-draft.test.ts`, mocks in-memory dos repos):
  - cria RASCUNHO com: `proposalId`, `companyId` da empresa do lead, `valorTotal` = value da proposta (string Decimal), `descricaoProjeto` = título da proposta + bullets do escopo do estimate (um por linha, prefixo "- "), `prazoEntregaDias` = deadlineDays do estimate (fallback 30), `tipo` SITE, `formaPagamento` PIX, `percentualEntrada` "50.00", `limiteRevisoes` 2, `contractorSnapshot` montado do contato+empresa, `origem` "APP";
  - `queue.enqueue` NÃO é chamado (mock com spy);
  - sem empresa → ValidationError; empresa sem documento → ValidationError;
  - proposta que já tem contrato (`findByProposalId` retorna algo) → retorna o existente sem criar de novo (idempotência);
  - estimate null → descricao = título só, prazo 30.

- [ ] **Step 2: Ver falhar** — `pnpm --filter @millead/api test -- run contract-draft` → FAIL.

- [ ] **Step 3: Implementar** em `contract-service.ts`:

```ts
async createDraftFromProposal(input: DraftFromProposalInput): Promise<Contract> {
  const existing = await this.contracts.findByProposalId(input.proposal.id);
  if (existing) return existing; // aceite repetido/retry nao duplica

  if (!input.company) throw new ValidationError("Lead da proposta não tem empresa vinculada.");
  const documento = (input.company.document ?? "").replace(/\D/g, "");
  if (!documento) throw new ValidationError("Empresa do lead não tem CPF/CNPJ cadastrado.");

  const organization = await this.organizations.findById(input.proposal.organizationId);
  if (!organization) throw new NotFoundError("Organização não encontrada.");

  const escopo = input.estimate?.scopeItems?.length
    ? `${input.proposal.title}\n${input.estimate.scopeItems.map((s) => `- ${s}`).join("\n")}`
    : input.proposal.title;

  const contractorSnapshot: ContractorSnapshot = {
    tipoPessoa: documento.length === 14 ? "PJ" : "PF",
    nome: input.contact?.name ?? input.company.name,
    documento,
    email: input.contact?.email ?? input.company.email ?? "",
    telefone: input.contact?.phone ?? input.company.phone ?? "",
    endereco: "",           // dono preenche na revisao
    nomeEmpresa: input.company.name,
  };

  const numeroPrefix = organization.slug.replace(/[^a-zA-Z0-9]/g, "").toUpperCase() || "CONTRATO";
  return this.contracts.create({
    organizationId: input.proposal.organizationId,
    companyId: input.company.id,
    leadId: input.proposal.leadId,
    createdById: null,
    proposalId: input.proposal.id,
    numeroPrefix,
    tipo: "SITE",
    descricaoProjeto: escopo,
    valorTotal: input.proposal.value,        // ja e string Decimal "1234.00"
    formaPagamento: "PIX",
    percentualEntrada: "50.00",
    prazoEntregaDias: input.estimate?.deadlineDays ?? 30,
    limiteRevisoes: 2,
    contractorSnapshot,
    contractedSnapshot: this.contractedSnapshot(organization.name),
    provider: this.gateway.nome,
    origem: "APP",
  });
  // SEM this.queue.enqueue -- deliberado (rascunho pra revisao do dono).
}
```

(Ajustar à assinatura real de `CreateContractInput`; adicionar `proposalId?: string` nele e no create do prisma-contract-repository; `findByProposalId` = findFirst where proposalId.)

- [ ] **Step 4: Ver passar** + suite inteira + typecheck.

- [ ] **Step 5: Commit** — `feat(api): contrato rascunho herdado da proposta aceita`

---

### Task 4: ProposalPublicService (get/accept/reject) + transições atômicas + notificações

**Files:**

- Create: `apps/api/src/application/services/proposal-public-service.ts`
- Test: `apps/api/src/application/services/proposal-public-service.test.ts`
- Modify: `apps/api/src/domain/repositories/proposal-repository.ts` + `infrastructure/prisma/prisma-proposal-repository.ts` (métodos atômicos + findByPublicToken)
- Modify: `apps/api/src/application/dto/proposal.dto.ts` (`rejectPublicSchema = z.object({ reason: z.string().max(2000).optional() })`)
- Modify: `apps/api/src/domain/services/proposal-notifier.ts` + impl (`propostaDecidida`)

**Interfaces:**

- Consumes: `ContractService.createDraftFromProposal` (Task 3), `PushSender.sendToOrg` (existente), `ActivityLogger.log` (existente; tipo `"OTHER"` com `payload.kind` — precedente estimate_converted), repositórios de lead (contato/empresa) e estimate (por proposalId).
- Produces (Task 5 usa):

```ts
export interface PublicProposalView {
  title: string;
  value: string;
  currency: string;
  validUntil: string | null; // ISO
  organizationName: string;
  pdfUrl: string | null;
  scopeItems: string[]; // do estimate, [] se nao houver
  status: "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";
}

class ProposalPublicService {
  getByToken(token: string): Promise<PublicProposalView>; // marca VIEWED na 1a vez
  accept(token: string, ip: string | null): Promise<{ status: string }>;
  reject(token: string, ip: string | null, reason?: string): Promise<{ status: string }>;
}
```

Repo novo (prisma-proposal-repository):

```ts
findByPublicToken(token: string): Promise<Proposal | null>;   // exclui status DRAFT (404 uniforme)
/** CAS: SENT -> VIEWED; count 0 = ja visto/estado diferente (ok, nao é erro). */
markViewed(id: string, viewedAt: Date): Promise<boolean>;
/** CAS: SENT|VIEWED -> ACCEPTED|REJECTED com decidedAt/decisionIp/respondedAt/rejectReason.
 *  count 0 = corrida perdida ou estado invalido -> null. */
decide(id: string, decision: "ACCEPTED" | "REJECTED", data: { decidedAt: Date; decisionIp: string | null; rejectReason?: string }): Promise<Proposal | null>;
markExpired(id: string): Promise<void>;      // updateMany status in SENT|VIEWED -> EXPIRED
```

- [ ] **Step 1: Testes primeiro** (mocks in-memory; casos obrigatórios):
  - `getByToken`: token inexistente → NotFoundError; proposta DRAFT → NotFoundError (o repo já filtra); primeira chamada com status SENT marca VIEWED + loga atividade UMA vez; segunda chamada não re-marca; devolve scopeItems do estimate e [] sem estimate.
  - `accept`: de SENT e de VIEWED → ACCEPTED, decidedAt/ip gravados, contrato draft criado, push + e-mail disparados, atividade logada (`kind: "proposal_accepted_public"`); expirada (`validUntil` no passado) → erro 410 (`GoneError` novo em app-error.ts: statusCode 410, code "GONE") e `markExpired` chamado; já ACCEPTED → retorna `{ status: "ACCEPTED" }` sem erro e sem duplicar contrato (idempotente); já REJECTED → ConflictError; falha do `createDraftFromProposal` (ValidationError) NÃO propaga — aceite fica, notificação leva `contractCreated: false` e o motivo.
  - `reject`: grava reason; sem reason ok; mesma máquina de estados; não cria contrato.
  - corrida: `decide` retornando null (CAS perdeu) → relê estado e responde como "já decidida" (idempotente ou 409 conforme decisão relida).
- [ ] **Step 2: Ver falhar.**
- [ ] **Step 3: Implementar service + repo + GoneError + notifier.** Notificação de decisão (`propostaDecidida` no ProposalNotifier — e-mail pro `env.OWNER_EMAIL`, engolindo erro como o briefing-notifier):

```ts
propostaDecidida(input: {
  titulo: string; valor: string; decision: "ACCEPTED" | "REJECTED";
  rejectReason: string | null; contractCreated: boolean; contractFailReason: string | null;
  proposalId: string;
}): Promise<void>;
```

Push (no service, best-effort): aceite → title `"✅ Proposta aceita!"`, body com título e valor, url `/proposals` (ou detalhe se a rota existir — conferir na web); recusa → `"❌ Proposta recusada"` com motivo curto. `void this.push.sendToOrg(...).catch(() => null)`.

- [ ] **Step 4: Ver passar + suite + typecheck.**
- [ ] **Step 5: Commit** — `feat(api): servico publico de aceite de proposta com transicoes atomicas`

---

### Task 5: Rotas públicas + controller + wiring

**Files:**

- Modify: `apps/api/src/interfaces/http/controllers/proposal-controller.ts` (handlers `getPublic/acceptPublic/rejectPublic`)
- Modify: `apps/api/src/interfaces/http/routes/proposal-routes.ts` (nova `createPublicProposalRoutes`)
- Modify: `apps/api/src/main/app.ts` (mount em `/api/v1/public`), `apps/api/src/main/container.ts` (wiring do ProposalPublicService com deps)

**Interfaces:**

- Consumes: `ProposalPublicService` (Task 4); padrão de router público com `rateLimit` local (copiar de `createPublicBriefingRoutes` em briefing-routes.ts:58 — readLimiter 30/min, writeLimiter mais apertado 10/min pras decisões) + `publicRateLimit` global no mount (app.ts:92).
- Produces: `GET /api/v1/public/proposals/:token`, `POST .../accept`, `POST .../reject` (Task 6 consome).

- [ ] **Step 1: Controller** — handlers thin sem auth: `getPublic` → `service.getByToken(req.params.token!)`; `acceptPublic` → `service.accept(req.params.token!, req.ip ?? null)`; `rejectPublic` → `service.reject(req.params.token!, req.ip ?? null, req.body.reason)` com `validateBody(rejectPublicSchema)` na rota.
- [ ] **Step 2: Router** `createPublicProposalRoutes(controller)` no molde do briefing (limiters locais); mount no app.ts junto dos outros dois `app.use("/api/v1/public", publicRateLimit, ...)`.
- [ ] **Step 3: Wiring** no container: `ProposalPublicService` recebe (proposalRepository, contractService, leadRepository, estimateRepository — conferir nome real do repo de estimate pra buscar por proposalId —, activityLogger, WebPushSender, proposalNotifier, organizationRepository se necessário pro nome da org).
- [ ] **Step 4: Boot + smoke** — `curl` GET com token inválido → 404; POST accept sem token → 404; rate-limit headers presentes. Suite + typecheck.
- [ ] **Step 5: Commit** — `feat(api): rotas publicas /public/proposals com rate-limit`

---

### Task 6: Web — página pública `/p/[token]`

**Files:**

- Create: `apps/web/src/services/proposals-public.ts`
- Create: `apps/web/src/app/p/[token]/page.tsx`
- Modify: `apps/web/src/types/api.ts` (tipo `PublicProposal` espelhando `PublicProposalView`)

**Interfaces:**

- Consumes: padrão de `briefings-public.ts:3-33` (fetch direto na API via `NEXT_PUBLIC_API_URL`, sem BFF, classe de erro com code); padrão visual de `/fechamento/[slug]/page.tsx` e `/b/[token]/page.tsx` (`min-h-dvh bg-background`, `max-w-2xl`, `<Logo />`, `Card`); botões h-11 (44px) no público (comentário em b/[token]/page.tsx:221).
- Produces: página pública standalone. `/p` já passa livre no middleware (não está em APP_PREFIXES; `/proposals` não colide — conferido).

- [ ] **Step 1: Service** `proposalsPublicService = { get(token), accept(token), reject(token, reason?) }` no molde exato do briefings-public (mesma classe de erro pública com `code` — importante: 410 = expirada, 409 = já decidida; o service expõe o code).
- [ ] **Step 2: Página** `"use client"` com React Query:
  - loading → skeleton; erro 404 → tela "Link indisponível" (molde CloudOff do b/[token]:66);
  - conteúdo: `<Logo />`, título, org, valor formatado (`Intl.NumberFormat pt-BR currency BRL`), validade ("válida até dd/mm/aaaa"), bullets do escopo, PDF embutido (`<iframe src={pdfUrl} className="h-[70vh] w-full rounded-lg border" title="Proposta em PDF" />` — só quando pdfUrl não-null; fallback: link "Abrir PDF");
  - status ACCEPTED → card de confirmação "Proposta aceita! Em breve você recebe o contrato." (também é o estado pós-clique); REJECTED → card neutro "Você recusou esta proposta. Mudou de ideia? Fale com a gente."; EXPIRED (ou erro 410 no accept) → "Esta proposta expirou. Fale com a gente pra atualizar os valores." + botão WhatsApp `https://wa.me/553399877375`;
  - botões: "Aceitar proposta" (primário, h-11, confirm dialog simples "Confirmar aceite?") e "Recusar" (ghost → abre textarea de motivo opcional + confirmar);
  - mutações com estados pending/erro (toast ou inline no molde do fechamento).
- [ ] **Step 3: Verificação** — `pnpm --filter @millead/web exec tsc --noEmit` + lint. Verificação visual: dev server + abrir `/p/TOKENFALSO123456789A` → tela de link indisponível (o caminho com dados reais depende de API+banco; o controlador cobre no smoke final).
- [ ] **Step 4: Commit** — `feat(web): pagina publica de aceite de proposta /p/[token]`

---

### Task 7: Web — telas internas (link público, rastreio, contrato vinculado)

**Files:**

- Create: `apps/web/src/features/proposals/public-link-card.tsx`
- Modify: tela de detalhe/lista de propostas existente (localizar: `apps/web/src/app/(app)/proposals/` e `apps/web/src/features/proposals/` — seguir a estrutura que encontrar)
- Modify: `apps/web/src/types/api.ts` (Proposal ganha `publicToken/viewedAt/decidedAt/rejectReason` — conferir se a API já devolve; se o serializer da entidade já expõe, só tipar)

**Interfaces:**

- Consumes: campos novos vindos do GET autenticado de proposta (Task 2 os adicionou à entidade — conferir que o controller devolve a entidade inteira).

- [ ] **Step 1: `public-link-card.tsx`** — recebe a proposta; se `publicToken` null → texto "O link é gerado quando a proposta é enviada."; senão: URL montada `${window.location.origin.replace(...)}` — NÃO: usar `NEXT_PUBLIC_WEB_URL`? O padrão do repo: link é do próprio app web → `${window.location.origin}/p/${token}` funciona porque a página pública é o mesmo deploy. Botão copiar (navigator.clipboard + toast), status: "Aberta pelo cliente em dd/mm hh:mm" (viewedAt), decisão ("Aceita em ..." verde / "Recusada em ..." + motivo em bloco).
- [ ] **Step 2: Integrar** no detalhe da proposta; quando ACCEPTED, buscar contrato vinculado — endpoint: adicionar ao GET autenticado da proposta o campo `contractId` (via `findByProposalId` no controller/service autenticado — 1 query) e renderizar botão "Ver contrato" → `/contracts/<id>` (conferir rota real de detalhe de contrato na web).
- [ ] **Step 3: tsc + lint + commit** — `feat(web): link publico e rastreio de decisao no detalhe da proposta`

---

### Task 8: Smoke ponta-a-ponta local + ajustes finais

**Files:** nenhum novo (correções pontuais se o smoke achar algo)

- [ ] **Step 1:** Subir API + web local (`.env` da raiz já tem DATABASE_URL). Criar (via app, logado no seed local, OU via script curto com o client Prisma apontando pro banco local SE houver banco local — se o `.env` apontar pra produção, NÃO criar dados: fazer o smoke só com token inexistente e validar 404/rate-limit, e anotar no relatório que o fluxo com dados reais fica pro deploy).
- [ ] **Step 2:** Com dados possíveis: proposta SENT → GET público (vira VIEWED) → accept → 200, contrato RASCUNHO criado com valores herdados, push/e-mail logados (sem SMTP local = no-op logado, ok); repetir accept → 200 idempotente; reject depois de accept → 409.
- [ ] **Step 3:** Suite inteira final: `pnpm --filter @millead/api test -- run` + typechecks + lints dos dois apps.
- [ ] **Step 4:** Commit de ajustes se houver — `fix(api|web): ajustes do smoke do aceite publico`

---

## Self-review (feito na escrita)

- **Cobertura da spec:** modelo (T1), token+SENT+e-mail (T2), herança com defaults e falha controlada (T3 — spec corrigida: empresa via lead, escopo via pricingEstimate), máquina de estados atômica + 410/409/idempotência + notificações (T4), rotas públicas com rate-limit e 404 uniforme (T5), página pública com todos os estados (T6), telas internas + guarda manual (T2 guarda, T7 UI), smoke (T8). ✓
- **Placeholders:** T2 Step 4 tinha um rascunho confuso — substituído por instrução concreta (buscar atual antes do update). Nenhum TBD. ✓
- **Tipos:** `PublicProposalView` (T4) = `PublicProposal` web (T6); `DraftFromProposalInput` (T3) consumido em T4; `GoneError` definido em T4 e usado em T6 (code 410). `value` como string Decimal consistente (T3/T4/T6). ✓
