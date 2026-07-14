# Arquitetura — MilLead

> Fase 1 (fundação). Sem telas de produto, sem IA, sem landing pages ainda —
> ver o roadmap de fases no [README](../README.md).

## Visão geral do monorepo

```
millead/
├── apps/
│   ├── api/            Backend Express (Clean Architecture) — porta 4000
│   └── web/             Next.js 15 / React 19 — porta 3000, hoje só a página de status
├── packages/
│   ├── database/        Schema Prisma + client singleton + catálogo de permissões
│   ├── typescript-config/  tsconfig base compartilhado
│   └── eslint-config/    eslint flat config compartilhado
├── docker-compose.yml    Postgres + Redis + Adminer (dev local)
└── docs/                 este diretório
```

pnpm workspaces + Turborepo, mesma convenção usada no outro monorepo do
autor (`milsaca`) — mas aqui o backend é Express + Prisma + Postgres +
Redis + BullMQ, não Supabase.

## Camadas do `apps/api` (Clean Architecture)

```
interfaces/  (HTTP: controllers, routes, middlewares) ─┐
                                                        │ depende de
application/ (use-cases, DTOs, serviços de orquestração) │
                                                        │ depende de
domain/      (entidades, contratos de repositório/serviço) ← não depende de nada
                                                        ▲
infrastructure/ (Prisma, JWT, bcrypt, Redis, BullMQ) ───┘ implementa os contratos do domain
```

Regra de dependência: **domain não importa nada de fora**. `application`
depende só de `domain` (via interfaces/ports). `infrastructure` implementa
essas interfaces. `interfaces/http` e `main` (composition root) são quem
liga tudo — é o único lugar que sabe que existe Express, Prisma ou Redis
simultaneamente.

- `domain/errors` — `AppError` e subclasses (`NotFoundError`,
  `ValidationError`, `UnauthorizedError`, `ForbiddenError`,
  `ConflictError`). O `errorHandler` HTTP é o único lugar que traduz isso
  pra status code.
- `domain/repositories/*` — contratos (`UserRepository`,
  `MembershipRepository` etc.), implementados em `infrastructure/prisma`.
- `domain/services/*` — contratos de serviços que não são persistência
  (`PasswordHasher`, `AccessTokenService`), implementados em
  `infrastructure/auth`.
- `application/use-cases/auth/*` — Register, Login, Refresh, Logout,
  GetCurrentUser. Cada um recebe as dependências via construtor (DI
  manual) e não sabe que HTTP existe.
- `main/container.ts` — composition root: instancia tudo na ordem certa.
  `main/app.ts` monta o Express app (sem `.listen()`, pra testes de
  integração poderem importar sem abrir porta). `main/server.ts` só chama
  `.listen()` e cuida do shutdown gracioso.

### Use-case vs. Service — quando usar cada um

`application/` tem duas formas de classe, de propósito:

- **Use-case** (uma classe por operação, ex.: `RegisterUseCase`,
  `LoginUseCase`) — pra operações com lógica de negócio real e
  não-trivial: múltiplos passos, decisões, efeitos colaterais que
  interagem entre si. O módulo de auth é todo assim.
- **Service** (uma classe por agregado, um método por operação, ex.:
  `CompanyService`, `TaskService`) — pra CRUD onde a "lógica de negócio"
  é essencialmente "existe? é deste tenant? então faz." Leads/Companies/
  Tasks/Meetings/Proposals (Fases 4-5) seguem esse padrão. `LeadService` é
  o híbrido: a maioria dos métodos é CRUD simples, mas `moveStage` tem
  lógica de verdade (valida o estágio, decide `status`/`closedAt`, grava
  `Activity`) — mora no Service porque é um método a mais no mesmo
  agregado, não porque a operação seja trivial.

Trocar um Service por N classes de use-case só porque "é o padrão" seria
ceremônia sem benefício pra CRUD puro — três linhas parecidas em métodos
de uma classe são melhores que uma abstração nova por operação.

### Por que DI manual, sem framework?

Nessa escala (um punhado de use-cases), um objeto de composição simples é
mais fácil de ler do que introduzir InversifyJS/tsyringe com decorators e
`reflect-metadata`. Reavaliar se o número de dependências crescer muito
nas próximas fases.

## Multi-tenant: shared schema + coluna discriminadora

Estratégia escolhida: **um único banco, um único schema Postgres**, com
`organizationId` em toda tabela pertencente a um tenant (`leads`,
`companies`, `tasks` etc. — ver [DATABASE.md](./DATABASE.md)).

Alternativas descartadas:

| Estratégia        | Por que não                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Schema por tenant | Migração vira N migrações; operacionalmente pesado pra um produto que ainda não sabe quantos tenants vai ter. |
| Banco por tenant  | Isolamento máximo, mas custo de infra e complexidade de conexão (pool por tenant) não se paga nessa fase.     |

Um usuário (`User`) pode pertencer a várias organizações via `Membership`
— cada `Membership` tem um `Role` (RBAC) só válido _naquela_ organização.
**Nunca confie num `organizationId` vindo do cliente** (body/query/header):
ele sempre vem do `organizationId` cravado no access token, resolvido de
novo contra o banco a cada request pelo middleware `authenticate`. Toda
query de repositório em camadas futuras (Leads, CRM etc.) deve filtrar por
esse `organizationId` do contexto autenticado — é assim que o isolamento
entre tenants é garantido nesta estratégia (não há isolamento automático
no nível do banco como haveria com schema/DB por tenant).

## Autenticação

- **Access token**: JWT, TTL curto (`JWT_ACCESS_TTL`, padrão 15min).
  Carrega só `{ sub: userId, organizationId }` — **de propósito, sem
  permissões embutidas**. Cada request autenticada resolve o papel e as
  permissões de novo no banco (`MembershipRepository.findContext`), pra
  uma mudança de permissão feita por um admin valer imediatamente, não só
  depois que o token expirar.
- **Refresh token**: opaco (não é JWT), alta entropia, guardado no banco
  como hash SHA-256 (não bcrypt — ver comentário em
  `infrastructure/auth/refresh-token-generator.ts` sobre por quê). TTL
  longo (`JWT_REFRESH_TTL`, padrão 30 dias).
- **Rotação atômica**: a cada `/auth/refresh`, a revogação do token antigo
  é um `UPDATE ... WHERE id = ? AND revoked_at IS NULL` (não um
  ler-depois-escrever) — isso é o que faz a detecção de reuso funcionar de
  verdade mesmo sob concorrência (duas requisições simultâneas com o mesmo
  token: só uma "ganha" a revogação, a outra é tratada como suspeita). Se
  a revogação falha (token já revogado -- reuso real ou corrida perdida),
  é tratado como possível roubo de sessão: **todas** as sessões do usuário
  são revogadas (`revokeAllForUser`), forçando novo login em todo lugar.
- **Senha**: bcrypt, 12 rounds. Login sempre roda um `bcrypt.compare`
  (contra um hash-isca quando o e-mail não existe) antes de responder --
  sem isso, a diferença de latência entre "e-mail não existe" e "senha
  errada" seria suficiente pra um atacante enumerar contas cadastradas.
- **Rate limiting**: `/auth/register`, `/auth/login` e `/auth/refresh`
  levam `authRateLimit` (20 requisições / 15min por IP) — defesa mínima
  contra força bruta antes de existir bloqueio por conta/CAPTCHA.
- **Logs**: `Authorization`/`Cookie` são redigidos nos logs estruturados
  (`config/logger.ts`) -- sem isso, todo access token apareceria em texto
  puro nos logs a cada request autenticada.

Fluxo: `POST /api/v1/auth/register` (cria org + usuário + papéis padrão +
sessão) → `POST /api/v1/auth/login` → `POST /api/v1/auth/refresh` →
`POST /api/v1/auth/logout` → `GET /api/v1/auth/me` (autenticado).

## RBAC

- `Permission` — catálogo global (`leads:read`, `billing:manage` etc.),
  fonte única de verdade em `packages/database/src/permissions.ts`.
- `Role` — por organização, com uma lista de `Permission` (via
  `RolePermission`).
- Toda organização nova ganha 4 papéis do sistema automaticamente
  (`SYSTEM_ROLES`): **Owner** (tudo), **Admin** (tudo exceto cobrança),
  **Sales** (opera o CRM), **Viewer** (só leitura).
- Middleware `requirePermission("leads:write")` em cada rota protegida —
  ainda não há rotas de negócio na Fase 1 (só `/auth/me`), mas o
  middleware já está pronto pra Fase 4 em diante.

## Auditoria de ações vs. auditoria de site

Dois conceitos com nomes parecidos, domínios diferentes:

- **`AuditLog`** (`domain/repositories/audit-log-repository.ts`) — trilha
  de segurança/sistema: quem fez o quê, quando (`auth.login`,
  `auth.register`, futuramente `membership.role_changed` etc.). É
  infraestrutura, chamado a partir dos use-cases via `AuditLogger`.
- **`Audit` / `AuditReport` / `AuditScore`** (schema Prisma) — feature de
  **produto** da Fase 6: auditoria automatizada de sites de prospects.
  Implementada: `POST /api/v1/audits` cria o registro como `QUEUED` e
  enfileira um job BullMQ (`audit-site`); o worker
  (`interfaces/jobs/audit.worker.ts`) roda o `AuditRunner`, que usa o
  motor `infrastructure/audit/http-site-auditor.ts` (fetch do site +
  análise de HTML/headers com cheerio, sem API externa) e grava report +
  scores 0-100 em 6 categorias, cada uma com a lista de checks no
  `details` (explicável na UI). A aplicação enfileira através da porta
  `domain/services/audit-queue.ts` — só o composition root e o worker
  conhecem BullMQ. `saveResult`/`markFailed` são idempotentes (upsert)
  porque o job tem retry.

## Redis / BullMQ

- `infrastructure/redis/redis-client.ts` — conexão genérica (cache,
  rate-limit futuro).
- `infrastructure/queue/connection.ts` — conexão **separada**, porque
  BullMQ exige `maxRetriesPerRequest: null`, incompatível com a conexão
  genérica.
- `infrastructure/queue/queues.ts` — fila `ping` de exemplo, `audit-site`
  (Fase 6, jobId = auditId pra deduplicar) e `landing-page` (Fase 8,
  geração por IA). Envio real de mensagem (provedor externo) ganharia fila
  própria no futuro.
- Workers rodam como **processo separado** do servidor HTTP
  (`pnpm dev:worker` / `pnpm start:worker`, entrypoint
  `interfaces/jobs/index.ts` que importa todos os workers) — prática
  padrão do BullMQ, pra não competir por CPU/memória com quem serve
  requisições. Atenção no Upstash free (500k comandos/mês): worker parado
  não consome; evite deixá-lo rodando sem necessidade.

## IA (Fase 7)

- Porta de domínio `domain/services/lead-ai.ts` (`LeadAi`: score, rascunho
  de mensagem, relatório) implementada por
  `infrastructure/ai/claude-lead-ai.ts` usando o SDK oficial da Anthropic
  (`@anthropic-ai/sdk`, modelo em `AI_MODEL`, padrão `claude-opus-4-8`,
  thinking adaptativo; o score usa structured output com JSON schema).
- O contexto vem de `AiService.buildContext` (lead + empresa + auditoria
  mais recente da Fase 6 + atividades) -- sempre filtrado por
  `organizationId`.
- `ANTHROPIC_API_KEY` é **opcional**: sem ela o composition root injeta
  `null` e os endpoints respondem `503 AI_NOT_CONFIGURED`; o front consulta
  `GET /api/v1/ai/status` e desabilita os botões. Com a chave no `.env`,
  reiniciar a API liga tudo.
- Chamadas são **síncronas** (o usuário espera segundos pelo resultado na
  UI) -- deliberado: fila só entraria pra processamento em lote, e cada
  worker BullMQ extra consome a cota do Upstash free.
- Não há envio automático de mensagem: a IA gera rascunho (`Message` com
  status `DRAFT`), o usuário revisa/copia/envia por fora e marca como
  enviada (registra `MESSAGE_SENT` na timeline). Envio real via provedor
  (Twilio etc.) é fase futura.

## Landing pages (Fase 8)

- Porta `domain/services/landing-page-generator.ts` implementada por
  `infrastructure/ai/claude-landing-page-generator.ts` -- pede ao modelo um
  documento HTML **autocontido** (CSS inline, SVG inline, sem JS e sem
  recursos externos; interações só com CSS) e valida que a resposta começa
  em `<!doctype html>`. Usa streaming do SDK (`max_tokens` alto estoura
  timeout sem stream).
- Geração roda na fila `landing-page` (worker
  `interfaces/jobs/landing-page.worker.ts`, concorrência 1, 1 tentativa --
  IA é cara; falha vira `FAILED` com mensagem e o usuário reenfileira).
  Status: `QUEUED → GENERATING → READY | FAILED`.
- **Rota pública** `GET /p/:slug` (sem auth) serve o HTML de páginas
  `isPublished` e incrementa `views` (fire-and-forget). O slug é
  `randomBytes(9)` base64url -- não enumerável. "Sem JS" no HTML gerado é
  também o que mantém a página dentro da CSP padrão do helmet.
- Permissões: reusa `leads:read`/`leads:write` de propósito (landing page é
  artefato de venda; permissão própria exigiria re-seed do catálogo RBAC).
- Tabela `landing_pages` criada na migration `20260714153905_landing_pages`
  com RLS habilitado (padrão Supabase do projeto).

## Uma dívida técnica assumida conscientemente: `tsx` em produção

`apps/api` roda via `tsx` tanto em dev quanto (por enquanto) em "prod"
(`pnpm start` = `tsx src/main/server.ts`, não `node dist/...`). Motivo:
`packages/database` é TypeScript puro sem etapa de build própria, e o
`package.json` dele aponta `exports` pra arquivos `.ts` — funciona perfeito
com `tsx` (que transpila on-the-fly, inclusive dentro de `node_modules`
via symlink do pnpm), mas quebraria com `node dist/...` puro (Node não
executa `.ts`). Pra este estágio (Fase 1, sem tráfego real), esse é um
custo aceitável. Migração futura recomendada: dar a `packages/database`
uma etapa de build própria (`tsc` → `dist/`) e trocar `apps/api` pra um
bundler (`tsup`/`esbuild`) que gera um único `dist/server.js`
autocontido — reavaliar quando o projeto for a produção com tráfego real.

## Fases futuras (não implementadas nesta etapa)

Ver roadmap completo no [README](../README.md#roadmap-de-fases). **Todas as
8 fases concluídas.** Próximos candidatos fora do roadmap original: envio
real de mensagens (Twilio/e-mail), edição de propostas, gestão de equipe
(API de membros) e deploy em produção (build de verdade no lugar do `tsx`).
