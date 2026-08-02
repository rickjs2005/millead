# MilSocial — Analisador de Métricas do Instagram (design)

**Data:** 2026-08-02
**Status:** aprovado pelo Rick (brainstorm em sessão)
**Escopo:** primeira de duas specs. Esta cobre só o analisador de métricas dos
posts do próprio Instagram da MilWeb. A segunda (radar de tendências +
gerador de roteiros) será brainstormada depois que esta estiver em uso.

## Objetivo

Ferramenta interna, de uso exclusivo do Rick, dentro do monorepo do MilLead:
coleta diariamente as métricas dos posts do Instagram da MilWeb, classifica
cada post por formato de conteúdo, e usa IA pra apontar padrões
("vídeos de redesign têm retenção 45% maior que vídeos de código") e sugerir
os próximos conteúdos. O gargalo que ela ataca: hoje as decisões de conteúdo
são por intuição, sem dado de retenção/conversão por formato.

## Não-escopo (YAGNI)

- **TikTok** — fica pra uma versão futura; a API exige aprovação de app mais
  burocrática e o conceito precisa ser validado no Instagram primeiro.
- **Multi-tenant** — NÃO é módulo pra clientes do MilLead. Nada de
  `organizationId`, nada de tela de configuração por org, nada de billing.
- **Publicação/agendamento de posts** — a ferramenta só lê métricas, não posta.
- **Radar de tendências internacionais** — segunda spec, projeto separado.

## Pré-requisitos (feitos pelo Rick na implementação, ~15 min)

1. Converter o Instagram da MilWeb pra conta **Business** (Configurações →
   Conta → mudar pra conta profissional). Sem necessidade de Página do
   Facebook — usa o fluxo "Instagram API with Instagram Login".
2. Criar app tipo **Business** no [developers.facebook.com](https://developers.facebook.com),
   adicionar o produto "Instagram". Como o app acessa só a própria conta
   (Rick é admin do app), roda em modo desenvolvimento **sem App Review**.
3. Gerar **long-lived access token** (~60 dias, renovável via endpoint
   `refresh_access_token` — o sync diário renova automaticamente quando
   faltar menos de 10 dias pra expirar).

## Arquitetura

Segue o molde do módulo "Centro de Custos" (o template estrutural mais
próximo): Prisma → domain → application → infrastructure → interfaces/http
na API; feature folder + service wrapper + page no web. Diferenças
deliberadas em relação ao template:

- Tabelas **sem** `organizationId` (precedente: `Permission`/`RolePermission`,
  que já são globais no schema).
- Gate por **e-mail do dono**, não por permissão de org.
- Rota web **fora** do grupo `(app)` — não aparece na sidebar de ninguém.

### Controle de acesso ("só o Rick vê")

- **API:** novo middleware `requireOwner` (irmão de `authenticate.ts` /
  `require-permission.ts`): após `authenticate`, compara o e-mail do usuário
  logado com `env.OWNER_EMAIL` (env que **já existe**, hoje usado só pra
  notificações). Diferente → 404 (não 403, pra não revelar que a rota existe).
- **Web:** nova rota `apps/web/src/app/admin/milsocial/` fora do grupo
  `(app)`. Adicionar `/admin` ao `APP_PREFIXES` do `middleware.ts` (gate de
  presença de sessão). O check de identidade real acontece no layout da
  rota: busca `/auth/me`, compara `user.email` com `NEXT_PUBLIC_OWNER_EMAIL`
  (novo env do web); diferente → `notFound()`. A proteção de verdade é a da
  API — o front só esconde.
- **Sync via cron externo:** o endpoint de sync aceita também autenticação
  por header `X-Sync-Key` comparado a `env.MILSOCIAL_SYNC_KEY` (novo env),
  pra permitir o n8n chamar sem sessão de usuário.

### Banco (Prisma, `packages/database/prisma/schema.prisma`)

Duas tabelas globais (sem `organizationId`, sem relação com `Organization`):

```prisma
/** MilSocial (ferramenta interna do dono — NÃO multi-tenant).
 *  Posts do Instagram da MilWeb. Sem organizationId de propósito:
 *  segue o precedente de Permission/RolePermission como tabela global. */
model SocialPost {
  id            String   @id @default(cuid())
  igMediaId     String   @unique          // id do media na Graph API
  igPermalink   String                    // URL pública do post
  mediaType     String                    // REELS | IMAGE | CAROUSEL_ALBUM | VIDEO
  caption       String?  @db.Text
  thumbnailUrl  String?
  publishedAt   DateTime
  format        SocialPostFormat @default(UNCLASSIFIED)
  formatSource  SocialFormatSource @default(NONE) // AI | MANUAL | NONE
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  snapshots     SocialMetricSnapshot[]

  @@index([publishedAt])
}

enum SocialPostFormat {
  UNCLASSIFIED
  REDESIGN        // redesign de site real
  BEFORE_AFTER    // antes x depois
  TIMELAPSE       // construção acelerada/timelapse
  REVIEW          // avaliação de site
  ANIMATION       // animações/parallax/scroll
  CODE_SETUP      // código, setup, stack
  OTHER
}

enum SocialFormatSource {
  NONE    // ainda não classificado
  AI      // classificado pela IA (legenda)
  MANUAL  // corrigido/definido pelo Rick no painel
}

/** Snapshot diário das métricas de um post (histórico acumulado —
 *  1 linha por post por dia de coleta). */
model SocialMetricSnapshot {
  id               String   @id @default(cuid())
  postId           String
  post             SocialPost @relation(fields: [postId], references: [id], onDelete: Cascade)
  collectedAt      DateTime @default(now())
  // Alcance e visualizações
  reach            Int?
  views            Int?     // "views" (métrica unificada da API v22+; cobre plays de reels)
  // Retenção (só reels/vídeo; null pra imagem/carrossel)
  avgWatchTimeMs   Int?     // ig_reels_avg_watch_time
  totalWatchTimeMs BigInt?  // ig_reels_video_view_total_time
  // Interações
  likes            Int?
  comments         Int?
  saved            Int?
  shares           Int?
  // Conversão
  profileVisits    Int?     // profile_visits (quando disponível por post)
  profileActivity  Int?     // profile_activity (cliques em link/contato a partir do post)

  @@unique([postId, collectedAt])
  @@index([collectedAt])
}

/** Singleton (1 linha) com o token do Instagram — fonte de verdade após o
 *  primeiro refresh, pra não precisar editar env no Render a cada 60 dias. */
model SocialConfig {
  id             String   @id @default("singleton")
  accessToken    String
  tokenExpiresAt DateTime
  updatedAt      DateTime @updatedAt
}
```

Notas:
- Snapshots diários (não update in-place) porque retenção/alcance continuam
  crescendo por dias — a curva por post é dado útil pra IA.
- Campos de métrica são todos opcionais: a Graph API não retorna todas as
  métricas pra todos os tipos de mídia; gravar `null` em vez de falhar.
- `profile_visits`/`profile_activity` por post têm disponibilidade limitada
  na API (nem toda conta/mídia expõe). O cliente trata a ausência como
  `null` sem erro — se a API não der o dado por post, o campo simplesmente
  fica vazio e o painel mostra "—".

### API (Express, `apps/api/src`)

Camadas no molde do módulo de custos:

- `domain/entities/social.ts` — tipos `SocialPost`, `SocialMetricSnapshot`,
  `SocialPostFormat`.
- `domain/repositories/social-repository.ts` — interface: `upsertPost`,
  `addSnapshot`, `listPostsWithLatestMetrics`, `getPostSeries`,
  `setFormat`, `getFormatComparison`.
- `domain/services/instagram-client.ts` — **porta** pro Instagram:
  `fetchMedia(after?)` (paginado), `fetchInsights(mediaId)`,
  `refreshToken()`. Permite mockar nos testes.
- `infrastructure/instagram/graph-api-client.ts` — implementação da porta
  com `fetch` na Graph API (`GET /me/media`, `GET /{media-id}/insights`,
  `GET /refresh_access_token`). Base URL `https://graph.instagram.com`.
  Token: seed inicial vem de `env.INSTAGRAM_ACCESS_TOKEN`; após o primeiro
  refresh, a linha da tabela `SocialConfig` (ver schema acima) passa a ser
  a fonte de verdade. Isso evita editar env no Render a cada 60 dias.
- `infrastructure/ai/claude-social-analyst.ts` — cliente Anthropic no molde
  exato do `claude-lead-ai.ts` (mesmo `env.ANTHROPIC_API_KEY`/`env.AI_MODEL`,
  `output_config` com json_schema, checagem de `refusal`). Dois métodos:
  - `classifyFormat(caption, mediaType)` → `{ format, confidence }`
  - `analyze(datasetJson)` → `{ report: string, suggestions: string[] }` —
    recebe o resumo agregado (posts + métricas + formatos) e devolve o
    relatório em português.
- `application/services/social-service.ts` — orquestra:
  - `sync()`: pagina `fetchMedia` (primeira execução traz histórico
    completo; depois para na primeira página onde todos os posts já
    existem), upsert de posts, `fetchInsights` de cada post ativo (posts
    com menos de 90 dias — mais antigos que isso têm métrica estável, pula
    pra economizar chamadas), grava snapshots, classifica formato via IA
    dos posts `UNCLASSIFIED` (nunca sobrescreve `MANUAL`), renova token se
    faltar <10 dias.
  - `listPosts()`, `getSeries(postId)`, `setFormat(postId, format)`
    (marca `formatSource = MANUAL`), `getComparison()` (média de cada
    métrica por formato), `generateAnalysis()` (monta dataset e chama a IA).
- `application/dto/social.dto.ts` — zod pros bodies/params.
- `interfaces/http/controllers/social-controller.ts` — thin controller.
- `interfaces/http/middlewares/require-owner.ts` — gate por `OWNER_EMAIL`
  (404 em caso de não-dono).
- `interfaces/http/routes/social-routes.ts` — montado em
  `/api/v1/admin/social`:
  - `POST /sync` — `authenticate`+`requireOwner` **ou** `X-Sync-Key` válido
  - `GET /posts` — lista com última métrica
  - `GET /posts/:id/series` — série temporal de snapshots
  - `PATCH /posts/:id/format` — correção manual
  - `GET /comparison` — agregado por formato
  - `POST /analysis` — gera relatório IA (retorna o texto; não persiste —
    YAGNI: histórico de relatórios só se sentir falta depois)
- Wiring em `main/container.ts` + `app.use` em `main/app.ts`.

Novos envs (todos `.optional()` no schema do `env.ts`, como as demais
integrações — sem eles a rota responde 503):
- `INSTAGRAM_ACCESS_TOKEN` — seed do token long-lived
- `MILSOCIAL_SYNC_KEY` — chave do cron externo

### Web (Next.js, `apps/web/src`)

- `app/admin/milsocial/layout.tsx` — guard: `/auth/me` → e-mail ≠
  `NEXT_PUBLIC_OWNER_EMAIL` → `notFound()`. Layout próprio minimalista
  (sem AppShell/sidebar do CRM).
- `app/admin/milsocial/page.tsx` — página única com 4 blocos:
  1. **Header**: botão "Sincronizar agora" (chama `POST /sync`, mostra
     spinner + resultado) e botão "Gerar análise".
  2. **Comparação por formato**: tabela — formato × (posts, reach médio,
     views médias, retenção média, interações médias, conversão média).
     É a resposta direta a "qual formato performa melhor".
  3. **Gráfico temporal**: linhas de reach/views por post ao longo das
     últimas semanas (biblioteca de chart que o web já usa; se não houver
     nenhuma, `recharts`).
  4. **Lista de posts**: thumbnail, data, formato (badge clicável → dropdown
     pra corrigir → `PATCH format`), métricas da última coleta, link pro
     post no Instagram.
  - Relatório da IA abre num painel/modal com o texto + sugestões, com botão
    copiar.
- `features/milsocial/` — hooks (`usePosts`, `useComparison`, `useSync`,
  `useAnalysis`), componentes dos 4 blocos, labels PT-BR dos formatos.
- `services/milsocial.ts` — wrappers do api-client (via BFF proxy existente,
  que já repassa o Bearer).
- `middleware.ts` — adicionar `/admin` ao `APP_PREFIXES`.

### Cron diário (n8n)

Workflow novo no n8n do Rick (rickj.app.n8n.cloud): Schedule Trigger (1x/dia,
madrugada) → HTTP Request `POST https://millead-api.onrender.com/api/v1/admin/social/sync`
com header `X-Sync-Key`. Vantagens sobre cron no Render: o n8n já existe e é
confiável; o plano free do Render hiberna e um scheduler interno não
dispararia. O request do n8n também serve de "wake-up" do serviço.
Timeout do n8n configurado generoso (o sync com histórico pode levar
minutos na primeira vez; o n8n só dispara as seguintes, incrementais).

## Fluxo de dados (resumo)

```
n8n (1x/dia) ──X-Sync-Key──▶ POST /admin/social/sync
                                  │
                    Graph API ◀───┤ fetchMedia + fetchInsights
                                  │
                       Prisma ◀───┤ upsert posts + snapshots
                                  │
                    Anthropic ◀───┘ classifica posts novos (legenda)

Rick ──▶ /admin/milsocial ──BFF──▶ GET posts/comparison/series
     └─▶ "Gerar análise" ──────▶ POST /analysis ──▶ Anthropic ──▶ relatório
```

## Tratamento de erros

- Graph API fora/token inválido: sync retorna 502 com mensagem clara;
  snapshots parciais já gravados são mantidos (sync é idempotente por
  `@@unique([postId, collectedAt])` — re-rodar no mesmo dia atualiza).
- Token expirado sem renovação possível: painel mostra aviso "reconectar
  Instagram" com instrução de gerar token novo e atualizar env/config.
- IA indisponível na classificação: post fica `UNCLASSIFIED`, próxima sync
  tenta de novo. Análise sob demanda: erro exibido no modal, sem retry
  automático.
- Métrica ausente pra um post (API não expõe): `null` no snapshot, "—" no
  painel, e a média por formato ignora nulls (não conta como zero).

## Testes

No padrão do repo (vitest junto do arquivo):
- `social.dto.test.ts` — validação zod.
- `social-service.test.ts` — sync com `InstagramClient` mockado: primeira
  carga (paginação completa), incremental (para quando tudo já existe),
  não sobrescreve formato MANUAL, pula insights de posts >90 dias, snapshot
  idempotente no mesmo dia; comparação por formato ignora nulls.
- `require-owner.test.ts` — dono passa, não-dono recebe 404, sem sessão 401;
  `X-Sync-Key` válida passa sem sessão, inválida 401.
- Classificação IA e cliente Graph: testados via mock da porta (sem chamadas
  reais em teste).

## Riscos e mitigação

- **Disponibilidade de métricas por post varia** (especialmente
  profile_visits/profile_activity e retenção pra não-reels): o design trata
  tudo como opcional desde o schema — pior caso o painel tem menos colunas
  preenchidas, nunca quebra.
- **Rate limit da Graph API** (200 chamadas/h/usuário): sync incremental +
  corte de 90 dias mantém o volume baixo (dezenas de chamadas/dia). Primeira
  carga histórica pode precisar de backoff — o cliente respeita header de
  rate limit e re-tenta com espera.
- **Token de 60 dias**: renovação automática no sync diário + persistência
  em `SocialConfig` elimina manutenção manual; aviso no painel é o fallback.
