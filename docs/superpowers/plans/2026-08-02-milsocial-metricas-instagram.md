# MilSocial — Analisador de Métricas do Instagram — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo interno (só o dono vê) no monorepo MilLead que sincroniza diariamente métricas dos posts do Instagram da MilWeb, classifica formato por IA e gera análise de padrões.

**Architecture:** Segue o molde do módulo Centro de Custos (Prisma → domain → application → infrastructure → interfaces/http na API; feature folder + service wrapper + page no web), com três desvios deliberados da convenção multi-tenant: tabelas globais sem `organizationId` (precedente: `Permission`/`RolePermission`), gate por e-mail do dono (`OWNER_EMAIL`) em vez de permissão de org, e rota web fora do grupo `(app)`.

**Tech Stack:** Express + Prisma + zod + vitest (API), Next.js App Router + Zustand + TanStack Query + recharts (web, todos já no repo), `@anthropic-ai/sdk` (já no repo), Instagram Graph API (`graph.instagram.com`, fetch nativo).

**Spec:** `docs/superpowers/specs/2026-08-02-milsocial-metricas-instagram-design.md`

## Global Constraints

- Tabelas novas NÃO têm `organizationId` e NÃO entram na lista de relations de `model Organization`.
- Acesso não-dono a qualquer rota `/api/v1/admin/social/*` responde **404** (não 403) — não revelar que a rota existe.
- Novos envs são `.optional()` no `envSchema`: sem eles o app sobe e as rotas do módulo respondem 503 (`SocialNotConfiguredError`).
- Classificação IA **nunca** sobrescreve formato com `formatSource = MANUAL`.
- Métrica ausente = `null` no snapshot (nunca zero); médias por formato ignoram nulls.
- Todos os textos de UI/erros em pt-BR, comentários de código em pt-BR (padrão do repo).
- Rodar comandos com `pnpm` (workspace). Testes: `pnpm --filter @millead/api test -- run <arquivo>`.
- Commits frequentes, mensagens em pt-BR sem acento no imperativo curto (padrão do log: `feat(api): ...`, `feat(web): ...`, `feat(db): ...`).

---

## Estrutura de arquivos (mapa completo)

```
packages/database/prisma/schema.prisma            (modify: 3 models + 2 enums)
apps/api/src/
  config/env.ts                                   (modify: 2 envs novos)
  domain/
    entities/social.ts                            (create)
    errors/app-error.ts                           (modify: SocialNotConfiguredError)
    repositories/social-repository.ts             (create)
    services/instagram-client.ts                  (create — porta)
    services/social-analyst.ts                    (create — porta)
  application/
    dto/social.dto.ts (+ .test.ts)                (create)
    services/social-service.ts (+ .test.ts)       (create)
  infrastructure/
    prisma/prisma-social-repository.ts            (create)
    instagram/graph-api-client.ts                 (create)
    ai/claude-social-analyst.ts                   (create)
  interfaces/http/
    middlewares/require-owner.ts (+ .test.ts)     (create)
    controllers/social-controller.ts              (create)
    routes/social-routes.ts                       (create)
  main/container.ts                               (modify: wiring)
  main/app.ts                                     (modify: mount /api/v1/admin/social)
apps/web/src/
  middleware.ts                                   (modify: "/admin" em APP_PREFIXES)
  types/api.ts                                    (modify: tipos MilSocial)
  services/milsocial.ts                           (create)
  app/admin/milsocial/layout.tsx                  (create — guard)
  app/admin/milsocial/page.tsx                    (create)
  features/milsocial/
    labels.ts                                     (create)
    hooks.ts                                      (create)
    components/comparison-table.tsx               (create)
    components/metrics-chart.tsx                  (create)
    components/post-list.tsx                      (create)
    components/analysis-dialog.tsx                (create)
.env.example                                      (modify)
docs/milsocial-setup.md                           (create — token IG + n8n)
```

---

### Task 1: Schema Prisma (SocialPost, SocialMetricSnapshot, SocialConfig)

**Files:**

- Modify: `packages/database/prisma/schema.prisma` (fim do arquivo)

**Interfaces:**

- Produces: modelos Prisma `SocialPost`, `SocialMetricSnapshot`, `SocialConfig`; enums `SocialPostFormat`, `SocialFormatSource` — consumidos pela Task 3 via client gerado em `packages/database/src/generated/client`.

- [ ] **Step 1: Adicionar modelos ao schema**

No fim de `packages/database/prisma/schema.prisma`, adicionar exatamente:

```prisma
// ============================================================
// MilSocial (ferramenta interna do dono -- NAO multi-tenant).
// Sem organizationId de proposito: segue o precedente de
// Permission/RolePermission como tabelas globais. NAO adicionar
// relations destes modelos em `model Organization`.
// ============================================================

enum SocialPostFormat {
  UNCLASSIFIED
  REDESIGN
  BEFORE_AFTER
  TIMELAPSE
  REVIEW
  ANIMATION
  CODE_SETUP
  OTHER
}

enum SocialFormatSource {
  NONE
  AI
  MANUAL
}

model SocialPost {
  id           String             @id @default(cuid())
  igMediaId    String             @unique
  igPermalink  String
  mediaType    String
  caption      String?            @db.Text
  thumbnailUrl String?
  publishedAt  DateTime
  format       SocialPostFormat   @default(UNCLASSIFIED)
  formatSource SocialFormatSource @default(NONE)
  createdAt    DateTime           @default(now())
  updatedAt    DateTime           @updatedAt
  snapshots    SocialMetricSnapshot[]

  @@index([publishedAt])
}

model SocialMetricSnapshot {
  id               String     @id @default(cuid())
  postId           String
  post             SocialPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  collectedAt      DateTime   @default(now())
  reach            Int?
  views            Int?
  avgWatchTimeMs   Int?
  totalWatchTimeMs BigInt?
  likes            Int?
  comments         Int?
  saved            Int?
  shares           Int?
  profileVisits    Int?
  profileActivity  Int?

  @@unique([postId, collectedAt])
  @@index([collectedAt])
}

model SocialConfig {
  id             String   @id @default("singleton")
  accessToken    String
  tokenExpiresAt DateTime
  updatedAt      DateTime @updatedAt
}
```

- [ ] **Step 2: Gerar migration e client**

Run: `pnpm --filter @millead/database exec prisma migrate dev --name add_milsocial_models`
Expected: migration criada em `packages/database/prisma/migrations/*_add_milsocial_models/`, client regenerado sem erro. (Requer `DATABASE_URL` local no `.env` do package — mesmo fluxo das migrations anteriores.)

- [ ] **Step 3: Verificar que o client expõe os tipos**

Run: `pnpm --filter @millead/database exec tsc --noEmit` (ou o typecheck do package se existir script)
Expected: sem erros; `SocialPostFormat` disponível no client gerado.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma
git commit -m "feat(db): modelos do MilSocial (posts, snapshots e config do Instagram)"
```

---

### Task 2: Envs novos + SocialNotConfiguredError + middleware requireOwner

**Files:**

- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/domain/errors/app-error.ts`
- Create: `apps/api/src/interfaces/http/middlewares/require-owner.ts`
- Test: `apps/api/src/interfaces/http/middlewares/require-owner.test.ts`

**Interfaces:**

- Consumes: `AppError` (existente), `UserRepository.findById(id): Promise<User | null>` (existente em `domain/repositories/user-repository.ts`), `req.auth: MembershipContext` (setado pelo `authenticate` existente; tem `userId`, NÃO tem e-mail — por isso o lookup).
- Produces: `env.INSTAGRAM_ACCESS_TOKEN?: string`, `env.MILSOCIAL_SYNC_KEY?: string`; classe `SocialNotConfiguredError` (503); `createRequireOwner(userRepository: UserRepository, ownerEmail: string | undefined): RequestHandler`.

- [ ] **Step 1: Envs**

Em `apps/api/src/config/env.ts`, após o bloco de IA (linha ~48), adicionar:

```ts
  // ===== MilSocial (ferramenta interna do dono) =====
  // Opcionais: sem eles as rotas /admin/social respondem 503.
  // INSTAGRAM_ACCESS_TOKEN e o seed inicial do token long-lived; apos o
  // primeiro refresh, a linha de SocialConfig no banco vira a fonte de verdade.
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  // Chave do cron externo (n8n) pro sync diario sem sessao de usuario.
  MILSOCIAL_SYNC_KEY: z.string().min(24).optional(),
```

- [ ] **Step 2: Erro 503**

Em `apps/api/src/domain/errors/app-error.ts`, após `AiNotConfiguredError`:

```ts
/** MilSocial sem token do Instagram configurado -- 503 acionavel. */
export class SocialNotConfiguredError extends AppError {
  readonly statusCode = 503;
  readonly code = "SOCIAL_NOT_CONFIGURED";

  constructor() {
    super(
      "O MilSocial nao esta configurado. Defina INSTAGRAM_ACCESS_TOKEN no .env e reinicie a API.",
    );
  }
}
```

- [ ] **Step 3: Teste do middleware (failing)**

`apps/api/src/interfaces/http/middlewares/require-owner.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import { createRequireOwner } from "./require-owner.js";

function makeReq(auth?: { userId: string }): Request {
  return { auth } as unknown as Request;
}
const res = {} as Response;

function makeUserRepo(email: string | null) {
  return {
    findById: vi.fn(async () => (email ? { id: "u1", email, name: "X", isActive: true } : null)),
  };
}

describe("createRequireOwner", () => {
  it("deixa o dono passar (comparacao case-insensitive)", async () => {
    const mw = createRequireOwner(
      makeUserRepo("Rick@MilWeb.com.br") as never,
      "rick@milweb.com.br",
    );
    const next = vi.fn();
    await mw(makeReq({ userId: "u1" }), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("responde 404 pra nao-dono (nao revela a rota)", async () => {
    const mw = createRequireOwner(makeUserRepo("outro@x.com") as never, "rick@milweb.com.br");
    const next = vi.fn();
    await mw(makeReq({ userId: "u1" }), res, next);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(NotFoundError);
  });

  it("responde 404 quando OWNER_EMAIL nao esta configurado", async () => {
    const mw = createRequireOwner(makeUserRepo("rick@milweb.com.br") as never, undefined);
    const next = vi.fn();
    await mw(makeReq({ userId: "u1" }), res, next);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(NotFoundError);
  });

  it("responde 401 sem req.auth", async () => {
    const mw = createRequireOwner(
      makeUserRepo("rick@milweb.com.br") as never,
      "rick@milweb.com.br",
    );
    const next = vi.fn();
    await mw(makeReq(undefined), res, next);
    expect(next.mock.calls[0]![0]).toBeInstanceOf(UnauthorizedError);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @millead/api test -- run require-owner`
Expected: FAIL (módulo `require-owner.js` não existe).

- [ ] **Step 5: Implementar o middleware**

`apps/api/src/interfaces/http/middlewares/require-owner.ts`:

```ts
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../../domain/errors/app-error.js";
import type { UserRepository } from "../../../domain/repositories/user-repository.js";

/**
 * Gate "so o dono ve" do MilSocial. Roda DEPOIS de `authenticate`.
 * req.auth (MembershipContext) nao carrega e-mail, entao resolve o usuario
 * pelo id. Nao-dono recebe 404 (nao 403) de proposito: a rota nem deve
 * parecer existir pra quem nao e o dono. OWNER_EMAIL ausente = ninguem passa.
 */
export function createRequireOwner(
  userRepository: UserRepository,
  ownerEmail: string | undefined,
): RequestHandler {
  const owner = ownerEmail?.trim().toLowerCase();
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new UnauthorizedError("Requer autenticação.");
      }
      if (!owner) {
        throw new NotFoundError("Rota não encontrada.");
      }
      const user = await userRepository.findById(req.auth.userId);
      if (!user || user.email.trim().toLowerCase() !== owner) {
        throw new NotFoundError("Rota não encontrada.");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @millead/api test -- run require-owner`
Expected: PASS (4 testes).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/config/env.ts apps/api/src/domain/errors/app-error.ts apps/api/src/interfaces/http/middlewares/require-owner.ts apps/api/src/interfaces/http/middlewares/require-owner.test.ts
git commit -m "feat(api): envs do MilSocial, erro 503 e middleware requireOwner"
```

---

### Task 3: Entidades, interface do repositório e implementação Prisma

**Files:**

- Create: `apps/api/src/domain/entities/social.ts`
- Create: `apps/api/src/domain/repositories/social-repository.ts`
- Create: `apps/api/src/infrastructure/prisma/prisma-social-repository.ts`

**Interfaces:**

- Consumes: client Prisma (mesmo import dos outros repos — copiar o import de `prisma-cost-repository.ts`, que expõe a instância compartilhada).
- Produces (Tasks 4-7 dependem destes nomes exatos):

```ts
// entities/social.ts
export type SocialPostFormat =
  | "UNCLASSIFIED"
  | "REDESIGN"
  | "BEFORE_AFTER"
  | "TIMELAPSE"
  | "REVIEW"
  | "ANIMATION"
  | "CODE_SETUP"
  | "OTHER";
export type SocialFormatSource = "NONE" | "AI" | "MANUAL";

export interface SocialPost {
  id: string;
  igMediaId: string;
  igPermalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  format: SocialPostFormat;
  formatSource: SocialFormatSource;
}

/** Metricas de uma coleta. Todos opcionais: a Graph API nao expoe tudo
 *  pra todo tipo de midia -- null nunca vira zero. */
export interface SocialMetrics {
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null; // BigInt no banco; number na entidade (< 2^53 na pratica)
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

export interface SocialMetricSnapshot extends SocialMetrics {
  id: string;
  postId: string;
  collectedAt: Date;
}

export interface SocialPostWithMetrics extends SocialPost {
  /** Snapshot mais recente, ou null se nunca coletado. */
  latest: SocialMetricSnapshot | null;
}

export interface SocialConfig {
  accessToken: string;
  tokenExpiresAt: Date;
}
```

```ts
// repositories/social-repository.ts
import type {
  SocialConfig,
  SocialMetrics,
  SocialMetricSnapshot,
  SocialPost,
  SocialPostFormat,
  SocialFormatSource,
  SocialPostWithMetrics,
} from "../entities/social.js";

export interface UpsertSocialPostInput {
  igMediaId: string;
  igPermalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

export interface SocialRepository {
  /** Cria ou atualiza (por igMediaId) dados editaveis do post; NUNCA toca format/formatSource. */
  upsertPost(data: UpsertSocialPostInput): Promise<{ post: SocialPost; created: boolean }>;
  listPosts(): Promise<SocialPostWithMetrics[]>;
  findPostById(id: string): Promise<SocialPost | null>;
  /** Posts publicados depois de `since` (corte de 90 dias do sync). */
  listPostsPublishedSince(since: Date): Promise<SocialPost[]>;
  listUnclassified(): Promise<SocialPost[]>;
  setFormat(
    postId: string,
    format: SocialPostFormat,
    source: SocialFormatSource,
  ): Promise<SocialPost | null>;
  /** Idempotente por dia: upsert na chave (postId, collectedAt truncado no dia). */
  addSnapshot(postId: string, collectedAt: Date, metrics: SocialMetrics): Promise<void>;
  getSeries(postId: string): Promise<SocialMetricSnapshot[]>;
  getConfig(): Promise<SocialConfig | null>;
  saveConfig(accessToken: string, tokenExpiresAt: Date): Promise<void>;
}
```

- [ ] **Step 1: Criar `entities/social.ts`** com o bloco acima (verbatim).

- [ ] **Step 2: Criar `repositories/social-repository.ts`** com o bloco acima (verbatim).

- [ ] **Step 3: Implementação Prisma**

`apps/api/src/infrastructure/prisma/prisma-social-repository.ts` — abrir `prisma-cost-repository.ts`, copiar o import do client e o estilo. Pontos que não são CRUD óbvio:

```ts
// upsertPost: prisma.socialPost.upsert em igMediaId; update NAO inclui
// format/formatSource. `created` = comparar createdAt === updatedAt e falso
// caso o registro ja existisse: mais simples, fazer findUnique antes e
// upsert depois (2 queries, volume minusculo).

// addSnapshot: truncar collectedAt pro inicio do dia (UTC) antes do upsert --
// e isso que torna o sync re-rodavel no mesmo dia sem duplicar:
const day = new Date(
  Date.UTC(collectedAt.getUTCFullYear(), collectedAt.getUTCMonth(), collectedAt.getUTCDate()),
);
await prisma.socialMetricSnapshot.upsert({
  where: { postId_collectedAt: { postId, collectedAt: day } },
  create: { postId, collectedAt: day, ...toDb(metrics) },
  update: toDb(metrics),
});
// toDb converte totalWatchTimeMs number|null -> BigInt|null; a leitura faz o inverso
// (Number(row.totalWatchTimeMs)) em TODOS os metodos que retornam snapshot.

// listPosts: prisma.socialPost.findMany({ orderBy: { publishedAt: "desc" },
//   include: { snapshots: { orderBy: { collectedAt: "desc" }, take: 1 } } })
// e mapear snapshots[0] ?? null -> latest.

// getConfig/saveConfig: upsert na linha id = "singleton".
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @millead/api exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/domain/entities/social.ts apps/api/src/domain/repositories/social-repository.ts apps/api/src/infrastructure/prisma/prisma-social-repository.ts
git commit -m "feat(api): entidades e repositorio Prisma do MilSocial"
```

---

### Task 4: Porta InstagramClient + cliente Graph API

**Files:**

- Create: `apps/api/src/domain/services/instagram-client.ts`
- Create: `apps/api/src/infrastructure/instagram/graph-api-client.ts`

**Interfaces:**

- Produces (Task 6 mocka a porta; nomes exatos):

```ts
// domain/services/instagram-client.ts
export interface InstagramMedia {
  igMediaId: string;
  permalink: string;
  mediaType: string; // "REELS" | "IMAGE" | "CAROUSEL_ALBUM" | "VIDEO"
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

export interface InstagramMediaPage {
  media: InstagramMedia[];
  nextCursor: string | null;
}

export interface InstagramInsights {
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

/** Porta pro Instagram -- o token e passado por chamada (a fonte de verdade
 *  do token e o SocialService, que le SocialConfig/env). */
export interface InstagramClient {
  fetchMediaPage(token: string, after?: string): Promise<InstagramMediaPage>;
  fetchInsights(token: string, igMediaId: string, mediaType: string): Promise<InstagramInsights>;
  refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }>;
}
```

- [ ] **Step 1: Criar a porta** (bloco acima, verbatim).

- [ ] **Step 2: Implementar `graph-api-client.ts`**

```ts
import type {
  InstagramClient,
  InstagramInsights,
  InstagramMedia,
  InstagramMediaPage,
} from "../../domain/services/instagram-client.js";

const BASE = "https://graph.instagram.com/v23.0";

/** Metricas pedidas por tipo de midia. Reels tem retencao; imagem/carrossel nao. */
const REEL_METRICS =
  "reach,views,likes,comments,saved,shares,ig_reels_avg_watch_time,ig_reels_video_view_total_time,profile_visits,profile_activity";
const STATIC_METRICS = "reach,views,likes,comments,saved,shares,profile_visits,profile_activity";

interface InsightValue {
  name: string;
  values?: Array<{ value: number }>;
  total_value?: { value: number };
}

export class GraphApiInstagramClient implements InstagramClient {
  async fetchMediaPage(token: string, after?: string): Promise<InstagramMediaPage> {
    const url = new URL(`${BASE}/me/media`);
    url.searchParams.set(
      "fields",
      "id,caption,media_type,permalink,thumbnail_url,media_url,timestamp",
    );
    url.searchParams.set("limit", "25");
    url.searchParams.set("access_token", token);
    if (after) url.searchParams.set("after", after);
    const data = await this.request<{
      data: Array<{
        id: string;
        caption?: string;
        media_type: string;
        permalink: string;
        thumbnail_url?: string;
        media_url?: string;
        timestamp: string;
      }>;
      paging?: { cursors?: { after?: string }; next?: string };
    }>(url);
    const media: InstagramMedia[] = data.data.map((m) => ({
      igMediaId: m.id,
      permalink: m.permalink,
      mediaType: m.media_type,
      caption: m.caption ?? null,
      // Videos/reels tem thumbnail_url; imagens usam media_url como preview.
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      publishedAt: new Date(m.timestamp),
    }));
    return { media, nextCursor: data.paging?.next ? (data.paging.cursors?.after ?? null) : null };
  }

  async fetchInsights(
    token: string,
    igMediaId: string,
    mediaType: string,
  ): Promise<InstagramInsights> {
    const isReel = mediaType === "REELS" || mediaType === "VIDEO";
    let metrics = isReel ? REEL_METRICS : STATIC_METRICS;
    let rows: InsightValue[];
    try {
      rows = await this.fetchInsightRows(token, igMediaId, metrics);
    } catch (err) {
      // Erro (#100) "metric X not supported": remove a metrica citada e tenta
      // UMA vez de novo -- a disponibilidade varia por conta/midia.
      const unsupported = /metric[s]? \(?([a-z_,\s]+)\)? (is|are) not (supported|available)/i.exec(
        err instanceof Error ? err.message : "",
      );
      if (!unsupported) throw err;
      const bad = unsupported[1]!.split(",").map((s) => s.trim());
      metrics = metrics
        .split(",")
        .filter((m) => !bad.includes(m))
        .join(",");
      rows = metrics ? await this.fetchInsightRows(token, igMediaId, metrics) : [];
    }
    const get = (name: string): number | null => {
      const row = rows.find((r) => r.name === name);
      const v = row?.total_value?.value ?? row?.values?.[0]?.value;
      return typeof v === "number" ? v : null;
    };
    return {
      reach: get("reach"),
      views: get("views"),
      // A API devolve avg watch time em ms e total em ms.
      avgWatchTimeMs: get("ig_reels_avg_watch_time"),
      totalWatchTimeMs: get("ig_reels_video_view_total_time"),
      likes: get("likes"),
      comments: get("comments"),
      saved: get("saved"),
      shares: get("shares"),
      profileVisits: get("profile_visits"),
      profileActivity: get("profile_activity"),
    };
  }

  async refreshToken(token: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const url = new URL(`${BASE.replace("/v23.0", "")}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", token);
    const data = await this.request<{ access_token: string; expires_in: number }>(url);
    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  private async fetchInsightRows(
    token: string,
    igMediaId: string,
    metrics: string,
  ): Promise<InsightValue[]> {
    const url = new URL(`${BASE}/${igMediaId}/insights`);
    url.searchParams.set("metric", metrics);
    url.searchParams.set("access_token", token);
    const data = await this.request<{ data: InsightValue[] }>(url);
    return data.data;
  }

  /** Fetch com tratamento de erro da Graph API e backoff simples de rate limit. */
  private async request<T>(url: URL, attempt = 0): Promise<T> {
    const res = await fetch(url);
    if (res.status === 429 && attempt < 3) {
      // Rate limit: espera exponencial (2s, 4s, 8s) e re-tenta.
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      return this.request<T>(url, attempt + 1);
    }
    const body = (await res.json()) as T & { error?: { message?: string; code?: number } };
    if (!res.ok || body.error) {
      throw new Error(
        `Instagram Graph API: ${body.error?.message ?? `HTTP ${res.status}`} (code ${body.error?.code ?? res.status})`,
      );
    }
    return body;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @millead/api exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/domain/services/instagram-client.ts apps/api/src/infrastructure/instagram/graph-api-client.ts
git commit -m "feat(api): porta e cliente da Instagram Graph API"
```

---

### Task 5: Porta SocialAnalyst + implementação Claude

**Files:**

- Create: `apps/api/src/domain/services/social-analyst.ts`
- Create: `apps/api/src/infrastructure/ai/claude-social-analyst.ts`

**Interfaces:**

- Consumes: padrão do `claude-lead-ai.ts` (mesmo SDK, `output_config` com json_schema, checagem de `refusal`).
- Produces:

```ts
// domain/services/social-analyst.ts
import type { SocialPostFormat } from "../entities/social.js";

export interface PostSummaryForAnalysis {
  caption: string | null;
  mediaType: string;
  format: SocialPostFormat;
  publishedAt: Date;
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

export interface SocialAnalysis {
  report: string; // markdown pt-BR
  suggestions: string[]; // proximos conteudos sugeridos
}

export interface SocialAnalyst {
  classifyFormat(caption: string | null, mediaType: string): Promise<SocialPostFormat>;
  analyze(posts: PostSummaryForAnalysis[]): Promise<SocialAnalysis>;
}
```

- [ ] **Step 1: Criar a porta** (bloco acima, verbatim).

- [ ] **Step 2: Implementar `claude-social-analyst.ts`**

Classe `ClaudeSocialAnalyst implements SocialAnalyst`, construtor `(apiKey: string, model: string)` igual ao `ClaudeLeadAi`.

`classifyFormat`: `messages.create` com `max_tokens: 500`, `thinking: { type: "adaptive" }`, `output_config: { effort: "low", format: { type: "json_schema", schema: CLASSIFY_SCHEMA } }` onde:

```ts
const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    format: {
      type: "string",
      enum: ["REDESIGN", "BEFORE_AFTER", "TIMELAPSE", "REVIEW", "ANIMATION", "CODE_SETUP", "OTHER"],
      description: "Formato de conteudo do post.",
    },
  },
  required: ["format"],
  additionalProperties: false,
} as const;
```

System prompt (verbatim):

```
Você classifica posts do Instagram da MilWeb (agência que vende sites premium
para pequenos negócios no Brasil) num formato de conteúdo. Formatos:
REDESIGN = redesign de um site real de empresa; BEFORE_AFTER = comparação
antes x depois; TIMELAPSE = construção acelerada/making of; REVIEW = avaliação
ou análise crítica de um site; ANIMATION = demonstração de animação, parallax
ou efeito de scroll; CODE_SETUP = código, stack, setup, bastidor técnico;
OTHER = qualquer outra coisa. Responda apenas o JSON.
```

User: `` `Legenda do post (tipo de mídia: ${mediaType}):\n\n${caption ?? "(sem legenda)"}` ``. Em `refusal`, lançar `Error("A IA recusou a classificação.")`. Retornar `parsed.format`.

`analyze`: `max_tokens: 3000`, `output_config: { effort: "medium", format: { type: "json_schema", schema: ANALYZE_SCHEMA } }`:

```ts
const ANALYZE_SCHEMA = {
  type: "object",
  properties: {
    report: {
      type: "string",
      description:
        "Relatorio executivo em Markdown pt-BR: padroes por formato, o que esta funcionando, o que abandonar.",
    },
    suggestions: {
      type: "array",
      items: { type: "string" },
      description: "3 a 5 sugestoes concretas de proximos posts (uma frase cada).",
    },
  },
  required: ["report", "suggestions"],
  additionalProperties: false,
} as const;
```

System prompt (verbatim):

```
Você é estrategista de conteúdo da MilWeb (agência de sites premium para
pequenos negócios no Brasil; público-alvo dos posts = donos de empresas
locais, NUNCA outros desenvolvedores). Analise as métricas dos posts e
escreva: quais formatos têm melhor retenção/alcance/conversão, com números;
padrões entre os que performam; o que abandonar; e sugestões de próximos
posts que maximizem contatos comerciais. Baseie-se só nos dados fornecidos;
se a amostra de um formato for pequena (menos de 3 posts), diga isso em vez
de concluir com confiança.
```

User: serializar `posts` num bloco por post (data, formato, tipo, métricas não-nulas com labels pt-BR, primeira linha da legenda) — mesmo estilo do `renderContext` do `claude-lead-ai.ts`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @millead/api exec tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/domain/services/social-analyst.ts apps/api/src/infrastructure/ai/claude-social-analyst.ts
git commit -m "feat(api): analista IA do MilSocial (classificacao e relatorio)"
```

---

### Task 6: DTOs + SocialService (com testes)

**Files:**

- Create: `apps/api/src/application/dto/social.dto.ts`
- Test: `apps/api/src/application/dto/social.dto.test.ts`
- Create: `apps/api/src/application/services/social-service.ts`
- Test: `apps/api/src/application/services/social-service.test.ts`

**Interfaces:**

- Consumes: `SocialRepository` (Task 3), `InstagramClient` (Task 4), `SocialAnalyst` (Task 5), `SocialNotConfiguredError` (Task 2), `env.INSTAGRAM_ACCESS_TOKEN` — injetado como string, não importar `env` no service.
- Produces (Task 7 depende):

```ts
export interface SyncResult {
  postsCreated: number;
  postsUpdated: number;
  snapshotsSaved: number;
  classified: number;
  tokenRefreshed: boolean;
}

export interface FormatComparisonRow {
  format: SocialPostFormat;
  postCount: number;
  avgReach: number | null;
  avgViews: number | null;
  avgWatchTimeMs: number | null;
  avgInteractions: number | null; // media de (likes+comments+saved+shares) por post
  avgProfileVisits: number | null;
}

class SocialService {
  constructor(
    repo: SocialRepository,
    instagram: InstagramClient,
    analyst: SocialAnalyst | null, // null quando ANTHROPIC_API_KEY ausente
    seedToken: string | undefined, // env.INSTAGRAM_ACCESS_TOKEN
  );
  sync(): Promise<SyncResult>;
  listPosts(): Promise<SocialPostWithMetrics[]>;
  getSeries(postId: string): Promise<SocialMetricSnapshot[]>; // NotFoundError se post nao existe
  setFormat(postId: string, format: SocialPostFormat): Promise<SocialPost>; // grava MANUAL; NotFoundError
  getComparison(): Promise<FormatComparisonRow[]>;
  generateAnalysis(): Promise<SocialAnalysis>; // AiNotConfiguredError se analyst null
}
```

- [ ] **Step 1: DTO + teste**

`social.dto.ts`:

```ts
import { z } from "zod";

export const setFormatSchema = z.object({
  format: z.enum([
    "UNCLASSIFIED",
    "REDESIGN",
    "BEFORE_AFTER",
    "TIMELAPSE",
    "REVIEW",
    "ANIMATION",
    "CODE_SETUP",
    "OTHER",
  ]),
});
export type SetFormatInput = z.infer<typeof setFormatSchema>;
```

`social.dto.test.ts`: 2 casos — aceita `{ format: "REDESIGN" }`; rejeita `{ format: "X" }` e `{}`.

- [ ] **Step 2: Rodar teste do DTO**

Run: `pnpm --filter @millead/api test -- run social.dto`
Expected: PASS.

- [ ] **Step 3: Testes do service (failing primeiro)**

`social-service.test.ts` — mocks in-memory da porta e do repo (sem Prisma). Casos obrigatórios:

```ts
// Helpers: makeRepo() devolve um SocialRepository fake baseado em Maps;
// makeInstagram(pages) devolve InstagramClient fake que serve paginas fixas
// e registra chamadas; makeAnalyst() classifica sempre "REDESIGN".

describe("SocialService.sync", () => {
  it("sem token configurado (nem config nem seed) lanca SocialNotConfiguredError");
  it("primeira carga: pagina ate o fim e cria todos os posts", ...);
    // 2 paginas de 2 posts -> postsCreated = 4; fetchMediaPage chamado 2x.
  it("incremental: para de paginar quando a pagina inteira ja existe", ...);
    // repo ja tem os 2 posts da pagina 1 -> fetchMediaPage chamado 1x, nextCursor ignorado.
  it("coleta insights so de posts publicados nos ultimos 90 dias", ...);
    // 1 post de ontem + 1 post de 120 dias atras -> fetchInsights chamado 1x.
  it("grava snapshot com metricas null preservadas (nao vira zero)", ...);
  it("classifica posts UNCLASSIFIED e grava formatSource AI", ...);
  it("nao reclassifica post com formatSource MANUAL", ...);
  it("analyst null: sync completa sem classificar (classified = 0)", ...);
  it("renova token quando faltam menos de 10 dias e persiste no config", ...);
    // config com tokenExpiresAt = daqui 5 dias -> refreshToken chamado, saveConfig chamado.
  it("nao renova token quando faltam mais de 10 dias", ...);
});

describe("SocialService.getComparison", () => {
  it("agrupa por formato e calcula medias ignorando nulls", ...);
    // 2 posts REDESIGN: reach 100 e null -> avgReach = 100 (nao 50).
  it("post sem snapshot nao conta nas medias mas conta no postCount", ...);
});

describe("SocialService.setFormat", () => {
  it("grava format com source MANUAL");
  it("post inexistente lanca NotFoundError");
});

describe("SocialService.generateAnalysis", () => {
  it("sem analyst lanca AiNotConfiguredError");
  it("monta PostSummaryForAnalysis a partir de listPosts e repassa ao analyst");
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `pnpm --filter @millead/api test -- run social-service`
Expected: FAIL (service não existe).

- [ ] **Step 5: Implementar `social-service.ts`**

Algoritmo do `sync()` (a parte não-óbvia):

```ts
async sync(): Promise<SyncResult> {
  // 1. Token: config do banco > seed do env. Sem nenhum -> 503.
  const config = await this.repo.getConfig();
  let token = config?.accessToken ?? this.seedToken;
  if (!token) throw new SocialNotConfiguredError();

  // 2. Renovacao: sem config ainda (primeiro sync com seed) OU faltando
  // menos de 10 dias -> refresh e persiste. Falha de refresh no primeiro
  // caso nao aborta (o seed pode ter acabado de ser gerado).
  let tokenRefreshed = false;
  const tenDays = 10 * 24 * 60 * 60 * 1000;
  if (!config || config.tokenExpiresAt.getTime() - Date.now() < tenDays) {
    try {
      const fresh = await this.instagram.refreshToken(token);
      await this.repo.saveConfig(fresh.accessToken, fresh.expiresAt);
      token = fresh.accessToken;
      tokenRefreshed = true;
    } catch {
      if (config) throw new SocialNotConfiguredError(); // token velho E refresh falhou
    }
  }

  // 3. Paginacao com parada incremental: para quando uma pagina INTEIRA
  // ja existia (posts antigos nao mudam de id; primeira carga vai ate o fim).
  let postsCreated = 0, postsUpdated = 0;
  let cursor: string | undefined;
  for (;;) {
    const page = await this.instagram.fetchMediaPage(token, cursor);
    let anyNew = false;
    for (const m of page.media) {
      const { created } = await this.repo.upsertPost({
        igMediaId: m.igMediaId, igPermalink: m.permalink, mediaType: m.mediaType,
        caption: m.caption, thumbnailUrl: m.thumbnailUrl, publishedAt: m.publishedAt,
      });
      if (created) { postsCreated++; anyNew = true; } else { postsUpdated++; }
    }
    if (!page.nextCursor || (!anyNew && page.media.length > 0)) break;
    cursor = page.nextCursor;
  }

  // 4. Insights: so posts dos ultimos 90 dias (mais velhos tem metrica estavel).
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const active = await this.repo.listPostsPublishedSince(since);
  let snapshotsSaved = 0;
  const now = new Date();
  for (const post of active) {
    const metrics = await this.instagram.fetchInsights(token, post.igMediaId, post.mediaType);
    await this.repo.addSnapshot(post.id, now, metrics);
    snapshotsSaved++;
  }

  // 5. Classificacao IA (best-effort; erro de UM post nao derruba o sync).
  let classified = 0;
  if (this.analyst) {
    for (const post of await this.repo.listUnclassified()) {
      try {
        const format = await this.analyst.classifyFormat(post.caption, post.mediaType);
        await this.repo.setFormat(post.id, format, "AI");
        classified++;
      } catch { /* fica UNCLASSIFIED; proxima sync tenta de novo */ }
    }
  }
  return { postsCreated, postsUpdated, snapshotsSaved, classified, tokenRefreshed };
}
```

`getComparison()`: a partir de `listPosts()`, agrupar por `format`; pra cada métrica, média só dos valores não-null (0 valores → null). `avgInteractions`: soma likes+comments+saved+shares por post tratando null como ausente — post com TODAS as 4 null não entra na média; caso contrário soma as não-null.

`generateAnalysis()`: `listPosts()` → mapear pra `PostSummaryForAnalysis` (usar `latest` de cada post; post sem snapshot entra com métricas null) → `analyst.analyze(...)`. `listUnclassified` no repo = `format: "UNCLASSIFIED"` (independente do source).

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @millead/api test -- run social-service` e `-- run social.dto`
Expected: PASS (todos).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/application/dto/social.dto.ts apps/api/src/application/dto/social.dto.test.ts apps/api/src/application/services/social-service.ts apps/api/src/application/services/social-service.test.ts
git commit -m "feat(api): SocialService com sync incremental, comparacao e analise"
```

---

### Task 7: Controller, rotas (dono OU X-Sync-Key) e wiring

**Files:**

- Create: `apps/api/src/interfaces/http/controllers/social-controller.ts`
- Create: `apps/api/src/interfaces/http/routes/social-routes.ts`
- Modify: `apps/api/src/main/container.ts`
- Modify: `apps/api/src/main/app.ts`

**Interfaces:**

- Consumes: `SocialService` (Task 6), `createRequireOwner` (Task 2), `authenticate`/`asyncHandler`/`validateBody` existentes.
- Produces: rotas montadas em `/api/v1/admin/social` (o web da Task 8 chama estes paths).

- [ ] **Step 1: Controller**

`social-controller.ts` (mesmo estilo thin do `CostController`; nenhum método usa `requireAuth` — o gate é dos middlewares — exceto nenhum precisar de organizationId, que este módulo não tem):

```ts
import type { Request, Response } from "express";
import type { SocialService } from "../../../application/services/social-service.js";
import type { SetFormatInput } from "../../../application/dto/social.dto.js";

export class SocialController {
  constructor(private readonly social: SocialService) {}

  sync = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.sync());
  };
  listPosts = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.listPosts());
  };
  series = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.getSeries(req.params.id!));
  };
  setFormat = async (req: Request, res: Response): Promise<void> => {
    const { format } = req.body as SetFormatInput;
    res.status(200).json(await this.social.setFormat(req.params.id!, format));
  };
  comparison = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.getComparison());
  };
  analysis = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.social.generateAnalysis());
  };
}
```

- [ ] **Step 2: Rotas**

`social-routes.ts`:

```ts
import { timingSafeEqual } from "node:crypto";
import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { setFormatSchema } from "../../../application/dto/social.dto.js";
import { UnauthorizedError } from "../../../domain/errors/app-error.js";
import { asyncHandler } from "../async-handler.js";
import type { SocialController } from "../controllers/social-controller.js";
import { validateBody } from "../middlewares/validate.js";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a),
    bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * /sync aceita DUAS formas de auth: sessao do dono (authenticate+requireOwner)
 * OU header X-Sync-Key (cron do n8n, sem sessao). Header presente decide a
 * rota de auth na hora -- invalido e 401 direto, sem fallback pra sessao.
 */
function ownerOrSyncKey(
  syncKey: string | undefined,
  authenticate: RequestHandler,
  requireOwner: RequestHandler,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers["x-sync-key"];
    if (typeof header === "string") {
      if (syncKey && safeEqual(header, syncKey)) {
        next();
        return;
      }
      next(new UnauthorizedError("Chave de sincronização inválida."));
      return;
    }
    authenticate(req, res, (err?: unknown) => {
      if (err) {
        next(err);
        return;
      }
      requireOwner(req, res, next);
    });
  };
}

export function createSocialRoutes(
  controller: SocialController,
  authenticate: RequestHandler,
  requireOwner: RequestHandler,
  syncKey: string | undefined,
): Router {
  const router = Router();

  router.post(
    "/sync",
    ownerOrSyncKey(syncKey, authenticate, requireOwner),
    asyncHandler(controller.sync),
  );

  // Demais rotas: sempre sessao do dono.
  router.use(authenticate, requireOwner);
  router.get("/posts", asyncHandler(controller.listPosts));
  router.get("/posts/:id/series", asyncHandler(controller.series));
  router.patch(
    "/posts/:id/format",
    validateBody(setFormatSchema),
    asyncHandler(controller.setFormat),
  );
  router.get("/comparison", asyncHandler(controller.comparison));
  router.post("/analysis", asyncHandler(controller.analysis));
  return router;
}
```

- [ ] **Step 3: Wiring no container**

Em `main/container.ts`, seguindo o padrão dos módulos existentes (imports + campo na interface + instâncias):

```ts
// imports
import { SocialService } from "../application/services/social-service.js";
import { PrismaSocialRepository } from "../infrastructure/prisma/prisma-social-repository.js";
import { GraphApiInstagramClient } from "../infrastructure/instagram/graph-api-client.js";
import { ClaudeSocialAnalyst } from "../infrastructure/ai/claude-social-analyst.js";
import { SocialController } from "../interfaces/http/controllers/social-controller.js";
import { createRequireOwner } from "../interfaces/http/middlewares/require-owner.js";

// na interface do container:
socialController: SocialController;
requireOwner: RequestHandler;

// instancias (junto das demais; userRepository ja existe no container):
const socialRepository = new PrismaSocialRepository();
const socialAnalyst = env.ANTHROPIC_API_KEY
  ? new ClaudeSocialAnalyst(env.ANTHROPIC_API_KEY, env.AI_MODEL)
  : null;
const socialService = new SocialService(
  socialRepository,
  new GraphApiInstagramClient(),
  socialAnalyst,
  env.INSTAGRAM_ACCESS_TOKEN,
);
const socialController = new SocialController(socialService);
const requireOwner = createRequireOwner(userRepository, env.OWNER_EMAIL);
// (exportar socialController e requireOwner no objeto retornado)
```

- [ ] **Step 4: Montar em `main/app.ts`**

Junto dos outros `app.use` (linha ~81):

```ts
app.use(
  "/api/v1/admin/social",
  createSocialRoutes(
    container.socialController,
    container.authenticate,
    container.requireOwner,
    env.MILSOCIAL_SYNC_KEY,
  ),
);
```

(adicionar o import de `createSocialRoutes` e conferir se `env` já é importado no arquivo; se não, importar de `../config/env.js`).

- [ ] **Step 5: Typecheck + suite completa + boot**

Run: `pnpm --filter @millead/api exec tsc --noEmit && pnpm --filter @millead/api test -- run`
Expected: sem erros, suite verde.
Run: subir a API local (`pnpm --filter @millead/api dev` ou equivalente do repo) e `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/v1/admin/social/sync -H "X-Sync-Key: errada"`
Expected: `401`. Sem header e sem sessão: `401`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/interfaces/http/controllers/social-controller.ts apps/api/src/interfaces/http/routes/social-routes.ts apps/api/src/main/container.ts apps/api/src/main/app.ts
git commit -m "feat(api): rotas /admin/social com gate do dono e X-Sync-Key"
```

---

### Task 8: Web — tipos, service wrapper, middleware e guard da rota

**Files:**

- Modify: `apps/web/src/types/api.ts` (fim do arquivo)
- Create: `apps/web/src/services/milsocial.ts`
- Modify: `apps/web/src/middleware.ts`
- Create: `apps/web/src/app/admin/milsocial/layout.tsx`

**Interfaces:**

- Consumes: `api` client (`services/api-client.ts`), `useMe` (`features/auth/hooks`), `useAuthStore`. BFF proxy existente já repassa `/api/v1/*` com Bearer.
- Produces: tipos + `milsocialService` usados pela Task 9. Novo env do web: `NEXT_PUBLIC_OWNER_EMAIL`.

- [ ] **Step 1: Tipos em `types/api.ts`**

```ts
// ===== MilSocial (ferramenta interna do dono) =====
export type SocialPostFormat =
  | "UNCLASSIFIED"
  | "REDESIGN"
  | "BEFORE_AFTER"
  | "TIMELAPSE"
  | "REVIEW"
  | "ANIMATION"
  | "CODE_SETUP"
  | "OTHER";

export interface SocialMetricSnapshot {
  id: string;
  postId: string;
  collectedAt: string;
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

export interface SocialPostWithMetrics {
  id: string;
  igMediaId: string;
  igPermalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  format: SocialPostFormat;
  formatSource: "NONE" | "AI" | "MANUAL";
  latest: SocialMetricSnapshot | null;
}

export interface FormatComparisonRow {
  format: SocialPostFormat;
  postCount: number;
  avgReach: number | null;
  avgViews: number | null;
  avgWatchTimeMs: number | null;
  avgInteractions: number | null;
  avgProfileVisits: number | null;
}

export interface SocialSyncResult {
  postsCreated: number;
  postsUpdated: number;
  snapshotsSaved: number;
  classified: number;
  tokenRefreshed: boolean;
}

export interface SocialAnalysis {
  report: string;
  suggestions: string[];
}
```

- [ ] **Step 2: Service wrapper**

`services/milsocial.ts`:

```ts
import { api } from "./api-client";
import type {
  FormatComparisonRow,
  SocialAnalysis,
  SocialMetricSnapshot,
  SocialPostFormat,
  SocialPostWithMetrics,
  SocialSyncResult,
} from "@/types/api";

export const milsocialService = {
  sync: () => api.post<SocialSyncResult>("/api/v1/admin/social/sync", {}),
  listPosts: () => api.get<SocialPostWithMetrics[]>("/api/v1/admin/social/posts"),
  series: (postId: string) =>
    api.get<SocialMetricSnapshot[]>(`/api/v1/admin/social/posts/${postId}/series`),
  setFormat: (postId: string, format: SocialPostFormat) =>
    api.patch<SocialPostWithMetrics>(`/api/v1/admin/social/posts/${postId}/format`, { format }),
  comparison: () => api.get<FormatComparisonRow[]>("/api/v1/admin/social/comparison"),
  analysis: () => api.post<SocialAnalysis>("/api/v1/admin/social/analysis", {}),
};
```

- [ ] **Step 3: Middleware**

Em `apps/web/src/middleware.ts`, adicionar `"/admin",` ao array `APP_PREFIXES` (gate server-side de presença de sessão; a identidade real é checada pela API e pelo layout).

- [ ] **Step 4: Guard layout**

`app/admin/milsocial/layout.tsx`:

```tsx
"use client";

import { notFound } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/features/auth/hooks";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Guard do MilSocial: so o dono (NEXT_PUBLIC_OWNER_EMAIL) ve a rota; qualquer
 * outro usuario cai em notFound() -- mesma semantica do 404 da API. Layout
 * proprio SEM AppShell/sidebar do CRM de proposito: a ferramenta e pessoal e
 * nao deve aparecer na navegacao de ninguem. A protecao real e a da API
 * (requireOwner); aqui e so pra nao renderizar a UI.
 */
export function MilsocialGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const { data, isError } = useMe(true);

  useEffect(() => {
    if (data) setSession(data);
  }, [data, setSession]);

  if (isError) notFound();
  if (!user) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

  const owner = process.env.NEXT_PUBLIC_OWNER_EMAIL?.trim().toLowerCase();
  if (!owner || user.email.trim().toLowerCase() !== owner) notFound();

  return <div className="mx-auto max-w-6xl p-6">{children}</div>;
}

export default function MilsocialLayout({ children }: { children: ReactNode }) {
  return <MilsocialGuard>{children}</MilsocialGuard>;
}
```

- [ ] **Step 5: Typecheck/lint**

Run: `pnpm --filter @millead/web exec tsc --noEmit`
Expected: sem erros. (Se `PublicUser` não tiver `email`, conferir `types/api.ts` — tem, é usado no perfil.)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/types/api.ts apps/web/src/services/milsocial.ts apps/web/src/middleware.ts apps/web/src/app/admin/milsocial/layout.tsx
git commit -m "feat(web): rota /admin/milsocial com guard do dono e service wrapper"
```

---

### Task 9: Web — página e componentes do painel

**Files:**

- Create: `apps/web/src/features/milsocial/labels.ts`
- Create: `apps/web/src/features/milsocial/hooks.ts`
- Create: `apps/web/src/features/milsocial/components/comparison-table.tsx`
- Create: `apps/web/src/features/milsocial/components/metrics-chart.tsx`
- Create: `apps/web/src/features/milsocial/components/post-list.tsx`
- Create: `apps/web/src/features/milsocial/components/analysis-dialog.tsx`
- Create: `apps/web/src/app/admin/milsocial/page.tsx`

**Interfaces:**

- Consumes: `milsocialService` e tipos (Task 8); TanStack Query (padrão dos hooks existentes em `features/*/hooks.ts` — copiar o estilo de `features/finance/hooks.ts`); componentes de UI existentes em `components/ui/*` (button, card, dialog, badge, dropdown-menu, table — conferir nomes no diretório antes de importar); `recharts` (já dependência).

- [ ] **Step 1: Labels**

`labels.ts`:

```ts
import type { SocialPostFormat } from "@/types/api";

export const FORMAT_LABELS: Record<SocialPostFormat, string> = {
  UNCLASSIFIED: "Sem categoria",
  REDESIGN: "Redesign",
  BEFORE_AFTER: "Antes x Depois",
  TIMELAPSE: "Timelapse",
  REVIEW: "Avaliação de site",
  ANIMATION: "Animação",
  CODE_SETUP: "Código/Setup",
  OTHER: "Outro",
};

/** "1:23" a partir de ms; "—" pra null. */
export function fmtWatchTime(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Numero compacto pt-BR ("12,3 mil") ; "—" pra null. */
export function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}
```

- [ ] **Step 2: Hooks**

`hooks.ts` — TanStack Query no estilo de `features/finance/hooks.ts`:

```ts
export function useSocialPosts(); // queryKey ["milsocial","posts"], milsocialService.listPosts
export function useComparison(); // queryKey ["milsocial","comparison"]
export function useSeries(postId: string | null); // enabled: !!postId
export function useSyncMutation(); // onSuccess: invalida ["milsocial"]
export function useSetFormatMutation(); // onSuccess: invalida ["milsocial"]
export function useAnalysisMutation(); // sem invalidacao (nao muda dados)
```

- [ ] **Step 3: Componentes**

- `comparison-table.tsx`: tabela (componentes ui do repo) — colunas: Formato (label), Posts, Alcance médio, Views médias, Retenção média (`fmtWatchTime`), Interações médias, Visitas ao perfil. Linhas ordenadas por `avgViews` desc (nulls por último). Recebe `rows: FormatComparisonRow[]`.
- `metrics-chart.tsx`: recharts `LineChart` responsivo — eixo X = `publishedAt` (formatado dd/MM), duas linhas: `reach` e `views` do snapshot `latest` de cada post, ordenado por data. Recebe `posts: SocialPostWithMetrics[]`. Posts sem `latest` são omitidos.
- `post-list.tsx`: lista/tabela de posts — thumbnail (img 48px, fallback quadrado neutro), data, badge de formato **clicável** abrindo dropdown com os 8 formatos (seleção → `useSetFormatMutation`); ícone/asterisco quando `formatSource === "AI"` (title "Classificado pela IA — clique para corrigir"); métricas do `latest` (`fmtNum`); link externo pro `igPermalink` ("Ver no Instagram").
- `analysis-dialog.tsx`: Dialog controlado — recebe `analysis: SocialAnalysis | null`, `loading`, `open`, `onOpenChange`. Renderiza `report` como markdown (se o repo já tiver um renderer de markdown, reusar; senão, `whitespace-pre-wrap` simples) + lista de `suggestions` + botão "Copiar" (`navigator.clipboard.writeText`).

- [ ] **Step 4: Página**

`app/admin/milsocial/page.tsx` — client component:

```tsx
"use client";
// Header: h1 "MilSocial" + subtitulo "Metricas do Instagram da MilWeb" +
//   botao "Sincronizar agora" (useSyncMutation; spinner enquanto pending;
//   toast/resultado inline "X novos, Y snapshots" no sucesso; erro em
//   vermelho com a mensagem da API -- inclui o caso 503 "nao configurado")
//   + botao "Gerar analise" (useAnalysisMutation -> abre analysis-dialog).
// Blocos em sequencia: <ComparisonTable/>, <MetricsChart/>, <PostList/>.
// Estado vazio (0 posts): card central "Nenhum post sincronizado ainda.
//   Clique em Sincronizar agora." — visivel tambem quando o sync retorna 503.
```

- [ ] **Step 5: Verificação visual**

Run: `pnpm --filter @millead/web dev`, logar com o usuário dono (seed local `rick@milweb.com.br` — conferir senha no seed), abrir `http://localhost:3000/admin/milsocial`.
Expected: página renderiza com estado vazio; botão Sincronizar mostra o erro 503 amigável (sem token local); logar com usuário NÃO-dono → 404.
Depois: `pnpm --filter @millead/web exec tsc --noEmit` sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/milsocial apps/web/src/app/admin/milsocial/page.tsx
git commit -m "feat(web): painel MilSocial (comparacao, grafico, posts e analise IA)"
```

---

### Task 10: .env.example + doc de setup (token IG + n8n)

**Files:**

- Modify: `.env.example` (raiz e/ou `apps/api/.env.example` — seguir onde os envs existentes estão documentados)
- Create: `docs/milsocial-setup.md`

- [ ] **Step 1: .env.example**

Adicionar (com placeholder óbvio, nunca valor real):

```
# ===== MilSocial (ferramenta interna do dono) =====
# INSTAGRAM_ACCESS_TOKEN=cole-aqui-o-long-lived-token-do-instagram
# MILSOCIAL_SYNC_KEY=gere-com--openssl-rand-hex-24
```

E no web (`apps/web/.env.example` ou equivalente): `# NEXT_PUBLIC_OWNER_EMAIL=rick@milweb.com.br`.

- [ ] **Step 2: Doc de setup**

`docs/milsocial-setup.md` com estas seções (conteúdo completo, não tópicos):

1. **Converter a conta**: passos do app do Instagram (Configurações → Conta → Mudar para conta profissional → Empresa).
2. **Criar o app na Meta**: developers.facebook.com → Criar app → tipo "Business" → adicionar produto "Instagram" → seção "API setup with Instagram login" → adicionar a conta @milweb como Instagram Tester e aceitar o convite no app do Instagram → gerar token pelo botão "Generate token" (já sai long-lived, ~60 dias).
3. **Configurar envs**: `INSTAGRAM_ACCESS_TOKEN` (token do passo 2), `MILSOCIAL_SYNC_KEY` (`openssl rand -hex 24`), `NEXT_PUBLIC_OWNER_EMAIL` — onde setar: Render (API) e Vercel (web), além dos `.env` locais.
4. **Primeiro sync**: abrir `/admin/milsocial` logado como dono → "Sincronizar agora" → confere posts. A renovação do token daí em diante é automática (persiste em `SocialConfig`).
5. **Workflow n8n** (rickj.app.n8n.cloud): Schedule Trigger diário 05:00 America/Sao_Paulo → nó HTTP Request: método POST, URL `https://millead-api.onrender.com/api/v1/admin/social/sync`, header `X-Sync-Key` = valor de `MILSOCIAL_SYNC_KEY`, timeout 120s, "Retry on fail" 2x com 60s de intervalo (cobre cold start do Render free).
6. **Solução de problemas**: 503 = token não configurado; 401 no n8n = chave errada; sync ok mas retenção vazia = post não é reel (esperado); token expirado de vez (painel avisa) = repetir passo 2 e atualizar env.

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/milsocial-setup.md apps/web/.env.example 2>/dev/null || git add -A -- .env.example docs/milsocial-setup.md
git commit -m "docs: setup do MilSocial (token do Instagram e cron no n8n)"
```

---

## Self-review (feito na escrita)

- **Cobertura da spec:** modelos (T1), gate 404 + sync key (T2/T7), repositório (T3), Graph API com retry de métrica não suportada + backoff 429 (T4), IA classificação/análise com prompts (T5), sync incremental + corte 90 dias + renovação de token + MANUAL intocável + nulls preservados (T6), rotas/wiring (T7), guard web + BFF (T8), painel com 4 blocos + correção manual de formato (T9), n8n + envs + doc (T10). Histórico inicial: coberto pela primeira carga completa da paginação (T6). ✓
- **Placeholders:** nenhum "TBD/TODO"; os corpos de teste da T6 estão como assinaturas `it(...)` com o cenário exato descrito em comentário — o implementer escreve o corpo com os fakes definidos no helper (entradas/saídas especificadas caso a caso). ✓
- **Consistência de tipos:** `SocialPostFormat`/`SocialFormatSource` idênticos em Prisma (T1), entidades (T3), DTO (T6) e web (T8); `latest` como nome do snapshot mais recente em T3/T8/T9; paths `/api/v1/admin/social/*` idênticos em T7/T8. ✓
