# Arquitetura — MilLead

> Documento vivo: começou na Fase 1 (fundação) e acompanha as fases
> seguintes — ver o roadmap no [README](../README.md).

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
├── docker-compose.yml    Postgres + Adminer (dev local alternativo)
└── docs/                 este diretório
```

pnpm workspaces + Turborepo, mesma convenção usada no outro monorepo do
autor (`milsaca`) — mas aqui o backend é Express + Prisma + Postgres, com a
fila de jobs no próprio Postgres (pg-boss), não Supabase.

## Camadas do `apps/api` (Clean Architecture)

```
interfaces/  (HTTP: controllers, routes, middlewares) ─┐
                                                        │ depende de
application/ (use-cases, DTOs, serviços de orquestração) │
                                                        │ depende de
domain/      (entidades, contratos de repositório/serviço) ← não depende de nada
                                                        ▲
infrastructure/ (Prisma, JWT, bcrypt, pg-boss) ─────────┘ implementa os contratos do domain
```

Regra de dependência: **domain não importa nada de fora**. `application`
depende só de `domain` (via interfaces/ports). `infrastructure` implementa
essas interfaces. `interfaces/http` e `main` (composition root) são quem
liga tudo — é o único lugar que sabe que existe Express, Prisma ou pg-boss
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
- Middleware `requirePermission("leads:write")` em cada rota protegida.
- Gestão de equipe usa `members:manage` e `roles:manage`. A camada de
  aplicação também impede escalada horizontal/vertical: papel e membro
  precisam pertencer ao tenant e o ator só concede permissões que já possui.
- Convites guardam apenas SHA-256 do token opaco. O token bruto aparece uma
  vez no link, expira em 7 dias e é consumido atomicamente na aceitação.

## Auditoria de ações vs. auditoria de site

Dois conceitos com nomes parecidos, domínios diferentes:

- **`AuditLog`** (`domain/repositories/audit-log-repository.ts`) — trilha
  de segurança/sistema: quem fez o quê, quando (`auth.login`,
  `auth.register`, futuramente `membership.role_changed` etc.). É
  infraestrutura, chamado a partir dos use-cases via `AuditLogger`.
- **`Audit` / `AuditReport` / `AuditScore`** (schema Prisma) — feature de
  **produto** da Fase 6: auditoria automatizada de sites de prospects.
  Implementada: `POST /api/v1/audits` cria o registro como `QUEUED` e
  enfileira um job pg-boss (`audit-site`); o worker
  (`interfaces/jobs/audit.worker.ts`) roda o `AuditRunner`, que usa o
  motor `infrastructure/audit/http-site-auditor.ts` (fetch do site +
  análise de HTML/headers com cheerio, sem API externa) e grava report +
  scores 0-100 em 6 categorias, cada uma com a lista de checks no
  `details` (explicável na UI). A aplicação enfileira através da porta
  `domain/services/audit-queue.ts` — só o composition root e o worker
  conhecem pg-boss. `saveResult`/`markFailed` são idempotentes (upsert)
  porque o job tem retry.

## Filas (pg-boss, no próprio Postgres)

> **BullMQ + Redis foi removido em 21/07/2026**, depois que a cota do Upstash
> free estourou (`ERR max requests limit exceeded`) e derrubou a API em
> produção por 23h. Menções a "BullMQ" que ainda apareçam em nomes de env var
> (`START_WORKERS`) ou comentários antigos são resíduo — a fila é pg-boss.

- `infrastructure/queue/boss.ts` — instância única do pg-boss (schema
  `pgboss`, criado sozinho no primeiro start). Tem listener de `error`
  registrado de propósito: sem ele, um erro de infra vira `'error'` não
  tratado e derruba o processo — exatamente o bug do Redis.
- `infrastructure/queue/queues.ts` — nomes e formatos de job: `audit-site`
  (Fase 6), `contract-process` (Fase 9), `briefing-process` (Fase 10) e
  `post-sale-onboarding` (automação pós-fechamento).
- Cada fila tem uma porta em `domain/services/*-queue.ts` e uma implementação
  `pg-*-queue.ts` — só o composition root e os workers conhecem pg-boss.
- Workers rodam como **processo separado** do servidor HTTP
  (`pnpm dev:worker` / `pnpm start:worker`, entrypoint
  `interfaces/jobs/index.ts` que importa todos os workers), pra não competir
  por CPU/memória com quem serve requisições. Em deploy econômico (Render
  free, um serviço só) `START_WORKERS=true` sobe os workers no mesmo
  processo da API.

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
  worker extra é mais um processo a manter de pé por um ganho que a UI
  não tem (o usuário espera o resultado na tela de qualquer jeito).
- Não há envio automático de mensagem: a IA gera rascunho (`Message` com
  status `DRAFT`), o usuário revisa/copia/envia por fora e marca como
  enviada (registra `MESSAGE_SENT` na timeline). Envio real via provedor
  (Twilio etc.) é fase futura.

## Diretor criativo (Fase 8)

> A geração automática de landing page por IA (HTML autocontido em fila +
> rota pública `/p/:slug`) foi **removida**. Ela dependia de
> `ANTHROPIC_API_KEY` e do worker, ficou dormente, e o diretor criativo
> ocupou o lugar dela na rota `/landing-pages`.

- **Composição no cliente.** `apps/web/src/features/creative-director/` monta
  o dossiê com funções puras; `buildDossier(input, direction)` é a mesma
  função com e sem IA. Sem direção, os blocos que exigem invenção viram
  instruções pra IA de destino; com direção, viram conteúdo. Nenhum artefato
  depende de rede -- a tela funciona inteira sem backend de IA.
- **Porta** `domain/services/creative-director.ts`, implementada por
  `infrastructure/ai/claude-creative-director.ts`: Claude Opus 5 com adaptive
  thinking, `effort: high`, streaming (`max_tokens` alto estoura timeout sem
  stream) e **structured outputs** (`output_config.format` + json_schema), o
  que torna JSON inválido impossível por construção. Trata
  `stop_reason: "refusal"` antes de ler o conteúdo.
- **Endpoint** `POST /api/v1/ai/creative-direction` vive sob `ai-routes` e
  reusa `AiService`/`AiController` -- é recurso de IA, não CRUD. Stateless
  por decisão de produto: **sem tabela, sem fila, sem migration**. Sem chave
  responde 503 (`AiNotConfiguredError`) e a UI já desabilita o botão
  consultando `GET /api/v1/ai/status`.
- Permissões: `leads:read`, a mesma do menu (artefato de venda; permissão
  própria exigiria re-seed do catálogo RBAC).
- Testes: vitest em `apps/web` cobre os builders puros e o prefill de
  briefing -- ver a seção Testes da
  [spec](./superpowers/specs/2026-07-25-ai-creative-director-design.md).

## Contratos (Fase 9 -- migrado do milweb-contratos)

- Sistema `milweb-contratos` (contratos.milweb.ai) foi absorvido: os models
  viraram `Contract`/`ContractSigner`/`ContractEvent`/`ContractSequence`
  multi-tenant; o "Cliente" do sistema antigo virou a `Company` do CRM
  (upsert por CPF/CNPJ na criação do contrato). O projeto Supabase antigo
  (`acqdvrbdtqniujijkixd`) foi pausado -- estava sem dados reais.
- Fluxo: criação (painel ou formulário público `/fechamento/:orgSlug`) ->
  fila `contract-process` -> worker gera o PDF (`pdf-lib`, 15 cláusulas em
  `infrastructure/contracts/pdf/render.ts`) -> cria documento no gateway de
  assinatura -> convite por e-mail (best-effort) -> webhook confirma ->
  `ASSINADO` + notificações. Idempotente em retry (reusa docId).
- Snapshots JSON (`contractorSnapshot`/`contractedSnapshot`) congelam as
  partes no momento do contrato (integridade jurídica); dados da contratada
  vêm das envs `CONTRACTOR_*`.
- PDFs ficam em `Bytes` no Postgres (volume baixo; evita credencial de
  storage). Download via rota autenticada `GET /:id/pdf`.
- Gateways: porta `domain/services/contract-signature.ts`; `mock` (padrão,
  simulado -- webhook aceita qualquer POST em dev) e `zapsign` (HMAC
  fail-closed). Clicksign/DocuSign/Autentique existem no repo antigo e
  podem ser portados sob a mesma porta.
- Permissões reusam `proposals:read/write` (contrato é o desfecho da
  proposta; permissão própria exigiria re-seed do RBAC).

## Automação pós-fechamento

Primeira etapa da costura dos módulos num fluxo único: contrato `ASSINADO` ->
lead ganho -> recebimentos -> briefing -> projeto -> tarefas. Design completo
em [a spec](./superpowers/specs/2026-08-26-post-sale-automation-design.md);
o que importa pra arquitetura:

- **Orquestrador**: `application/services/post-sale-onboarding-service.ts`.
  É um Service (não N use-cases) pelo mesmo critério do `LeadService.moveStage`
  — um agregado, operações do mesmo ciclo de vida. Recebe as dependências
  num objeto (`PostSaleOnboardingDeps`) em vez de 15 parâmetros posicionais.
- **Gatilho**: `ContractService.handleSignatureWebhook` chama `trigger()`
  DEPOIS de `markSigned`. A assinatura é fato consumado: `trigger` engole
  qualquer erro por dentro **e** o chamador tem `try/catch` por fora. A
  redundância é deliberada — um 500 no webhook faria o provedor reenviar, e
  o reenvio sai cedo no `status === "ASSINADO"`, então o cliente nunca
  receberia a notificação de contrato assinado por causa da automação.
- **Execução**: fila `post-sale-onboarding` -> `interfaces/jobs/post-sale.worker.ts`.
  O trabalho pesado nunca roda dentro da requisição do webhook.
- **Composition root duplo**: `main/post-sale-factory.ts` monta o grafo uma
  vez e é usado pelo `container.ts` (API) e pelo worker. Sem isso, o worker
  recriaria à mão a mesma dúzia de repositórios e a próxima dependência nova
  entraria em um dos dois lugares e não no outro.
- **Idempotência em três camadas de banco** (`automation_executions`,
  `automation_steps`, `automation_artifacts`, cada uma com o seu unique) mais
  um compare-and-swap de status. Reenviar o webhook N vezes não duplica lead
  movido, plano, briefing, projeto nem tarefa. Ver
  [DATABASE.md](./DATABASE.md#8-automação-pós-fechamento).
- **Nada é adivinhado**: faltando configuração obrigatória a etapa registra
  `NEEDS_ACTION` e cria uma tarefa acionável, em vez de escolher um valor
  plausível. Por isso os campos financeiros da configuração são anuláveis
  **sem default no banco**.
- Permissões reusadas: `settings:manage` pra configurar,
  `proposals:read/write` pra ver/reprocessar a execução no contrato.

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
real de mensagens (Twilio/e-mail), automação Lead → Projeto, central “Hoje”
e deploy em produção (build de verdade no lugar do `tsx`).
