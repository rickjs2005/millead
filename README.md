# MilLead

CRM e prospecção de leads para a MilWeb. **Todas as 8 fases do roadmap
implementadas**: fundação, auth, Leads, CRM/Pipeline, auditoria de sites
(BullMQ), IA com Claude (score, mensagens, relatórios) e o diretor criativo
de sites. O frontend cobre todos os módulos e consome a API via
`apps/web/src/services`. Os recursos de IA exigem `ANTHROPIC_API_KEY` no
`.env`. Ver [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) e
[docs/DATABASE.md](./docs/DATABASE.md) para os detalhes técnicos.

## Stack

Next.js 15 · React 19 · TypeScript · Node.js · Express · PostgreSQL ·
Prisma · Redis · BullMQ · pnpm workspaces + Turborepo.

Arquitetura: Clean Architecture (domain/application/infrastructure/
interfaces) num monólito modular, multi-tenant (shared schema + coluna
discriminadora `organizationId`).

## Quickstart

Pré-requisitos: Node ≥22, pnpm ≥10. **Não precisa de Docker**: em dev o
Postgres roda no [Supabase](https://supabase.com) e o Redis no
[Upstash](https://upstash.com) (free tier dos dois) — veja os formatos das
URLs no `.env.example`. Quem preferir infra local pode usar o
`docker-compose.yml`, que continua no repositório como alternativa.

```bash
cp .env.example .env          # preencha DATABASE_URL/REDIS_URL e os segredos JWT
pnpm install
pnpm db:generate
pnpm db:migrate:deploy         # aplica as migrations existentes no banco
pnpm db:seed                    # cria org "MilWeb", papéis padrão e o usuário owner
pnpm dev                        # api em :4000, web em :3000
```

Depois disso, `http://localhost:3000` redireciona pra tela de login (ou pro
dashboard, se já houver sessão). Login de teste criado pelo seed:
`rick@milweb.com.br` / senha em `SEED_OWNER_PASSWORD` (padrão
`millead-dev-only` se a env var não for definida). Pra checar a conexão com
o banco: `GET http://localhost:4000/health/ready` responde
`{"status":"ready","checks":{"database":true}}` (503 e `not-ready` se o
`SELECT 1` falhar). O Redis **não** entra nesse check — a API sobe e serve
sem ele; quem depende de fila é o worker.

`GET /health` responde `{"status":"ok","commit":"6eec5df","startedAt":"..."}`.
O `commit` é o SHA curto do código em execução (`RENDER_GIT_COMMIT`, que o
Render injeta sozinho; `dev` fora de um deploy) e o `startedAt` denuncia
restart e cold start. **Use os dois antes de investigar comportamento novo
que "não subiu"**: web (Vercel) e API (Render) deployam separado, então é
comum o front já ter a mudança e a API ainda não.

Pra rodar o worker de filas (BullMQ) separadamente:

```bash
pnpm --filter @millead/api dev:worker
```

> **Atenção (Upstash free tier):** o limite é de 500 mil comandos Redis/mês
> e o BullMQ faz polling constante — evite deixar o worker rodando sem
> necessidade. Se estourar, a alternativa é um Redis local (Docker ou, no
> Windows, [Memurai](https://www.memurai.com)).

### Notas sobre o Supabase

- Use sempre a connection string do **session pooler** (porta 5432 em
  `aws-1-sa-east-1.pooler.supabase.com`) — a conexão direta
  (`db.<ref>.supabase.co`) é IPv6-only e não funciona na maioria das redes
  domésticas; o transaction pooler (porta 6543) não suporta migrations.
- O Supabase expõe o schema `public` numa API REST própria (PostgREST).
  Por isso **toda tabela tem RLS habilitado sem policies** — isso bloqueia
  o acesso externo sem afetar o app, que entra via Prisma como dono das
  tabelas. **Toda migration que criar tabela nova precisa incluir**
  `ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;` (o aviso INFO
  "RLS Enabled No Policy" nos advisors do Supabase é intencional).

## Scripts principais

| Comando                          | O que faz                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`                       | api + web em modo watch (via Turborepo)                                         |
| `pnpm build`                     | build de produção de tudo                                                       |
| `pnpm lint` / `pnpm type-check`  | qualidade em todo o monorepo                                                    |
| `pnpm db:studio`                 | GUI do Prisma pra inspecionar o banco                                           |
| `pnpm docker:up` / `docker:down` | sobe/derruba a infra local alternativa (opcional — o padrão é Supabase+Upstash) |

## Roadmap de fases

- [x] **Fase 1 — Arquitetura e infraestrutura**: monorepo, Clean
      Architecture, Prisma, auth JWT+refresh, RBAC, auditoria de ações,
      multi-tenant, Docker, CI.
- [x] **Fase 2 — Banco de dados**: todas as entidades modeladas (ver
      [docs/DATABASE.md](./docs/DATABASE.md)).
- [x] **Fase 3 — Autenticação**: endpoints prontos
      (register/login/refresh/logout/me); as telas de login/cadastro já
      existem em `apps/web/src/app/(auth)`.
- [x] **Fase 4 — Módulo Leads (API)**: empresas + leads + contatos/notas/
      etiquetas + timeline, ver [API — Leads & CRM](#api--leads--crm)
      abaixo.
- [x] **Fase 5 — CRM (API)**: pipeline/estágios, mover lead de estágio,
      tarefas, reuniões, propostas -- todos com API completa.
- [x] **Fase 6 — Auditoria de sites**: fila BullMQ (`audit-site`), worker
      assíncrono e scoring próprio em 6 categorias (performance, SEO,
      acessibilidade, segurança, mobile, design) com checks explicáveis --
      o motor (`infrastructure/audit/http-site-auditor.ts`) baixa o site e
      analisa HTML/headers, sem depender de API externa. UI em `/audit`,
      no detalhe da empresa e na aba Auditoria do lead. **Requer o worker
      rodando** (`pnpm --filter @millead/api dev:worker`).
- [x] **Fase 7 — IA**: score de oportunidade (0-100 com justificativa na
      timeline), rascunhos de mensagens personalizadas (WhatsApp/e-mail/SMS,
      com modelos opcionais) e relatório executivo do lead -- tudo via API
      da Anthropic (Claude, `@anthropic-ai/sdk`), usando lead + empresa +
      auditoria da Fase 6 como contexto. **Requer `ANTHROPIC_API_KEY` no
      `.env`** (paga por uso; sem ela os recursos ficam desabilitados com
      aviso na UI). Não há envio automático de mensagens -- a IA gera o
      rascunho, você revisa, copia e envia; "marcar como enviada" registra
      na timeline. Envio real (Twilio/e-mail) fica pra fase futura.
- [x] **Fase 8 — Diretor criativo**: em vez de gerar o site pronto, o sistema
      produz o **dossiê de direção criativa** que alimenta as IAs de código,
      vídeo e imagem. Saída em 5 abas, cada uma com copiar próprio: dossiê
      (análise estratégica, conceito, storytelling em 3 atos, direção de arte,
      moodboard), prompt de código pro Claude Code, cenas de vídeo com prompt
      pronto pra **Higgsfield/Veo/Runway**, stills pra **Midjourney/Flux/
      Leonardo** e checklists de aceite (UX, performance, SEO, responsividade,
      acessibilidade, conversão). Cada cena declara em que seção do site vive,
      como o scroll a dirige e qual o primeiro/último frame -- é o que permite
      a cena seguinte continuar de onde a anterior parou.
      **Funciona sem `ANTHROPIC_API_KEY`**: o dossiê é montado no cliente e os
      blocos que exigem invenção viram instruções. Com a chave, o botão
      "Direção criativa com IA" chama Claude e materializa conceito, narrativa,
      paleta, moodboard e cenas para aquele negócio específico (~40-90s,
      `POST /api/v1/ai/creative-direction`, sem persistência). UI em
      `/landing-pages`. Prefill opcional a partir de empresa ou de briefing
      concluído. Ver [a spec](./docs/superpowers/specs/2026-07-25-ai-creative-director-design.md).
- [x] **Fase 9 — Contratos (migrado do milweb-contratos)**: fluxo completo
      de fechamento -> PDF jurídico (15 cláusulas, `pdf-lib`) -> assinatura
      eletrônica -> acompanhamento. Formulário público em
      `/fechamento/:orgSlug` (rate-limit por IP), numeração automática
      `MILWEB-AAAA-NNNNNN` por org+ano, PDFs guardados no banco, timeline
      de eventos, webhook de assinatura com HMAC. Provedor padrão: **mock**
      (simulado); ZapSign pronto via `SIGNATURE_PROVIDER=zapsign` + token.
      E-mail/WhatsApp opcionais via env. O contratante vira `Company` do
      CRM automaticamente (upsert por CPF/CNPJ). Requer o worker rodando.
- [x] **Frontend**: login/cadastro, dashboard, leads (tabela + kanban),
      empresas, agenda, reuniões, tarefas, propostas, mensagens, auditoria,
      briefings, contratos, diretor criativo e configurações, todos em
      `apps/web` consumindo a API via `src/services` (um serviço por
      recurso). Varredura de 28/07/2026 cruzando rotas da API com chamadas
      do front: **95 de 95 endpoints consumidos**, nenhuma tela faltando.
      Os únicos endpoints sem chamada no front são o
      `POST /api/v1/webhooks/signature`, que é chamado pelo provedor de
      assinatura e não pelo navegador, e capacidades ainda adormecidas
      (ver abaixo).

## O que falta de verdade

- [ ] **Gestão de membros (API + telas)**: é a única ausência de produto.
      Hoje `settings/team` é um `EmptyState` honesto e as rotas de
      `/api/v1/settings` só cobrem integrações e dois `PATCH`. Sem isso a
      organização é de usuário único.

- **Filtros por pessoa, prontos e adormecidos**: `ownerId` (leads) e
  `assigneeId` (tarefas) já existem no schema, no repositório Prisma e nos
  tipos do front, mas nenhum formulário atribui responsável e nenhuma tela
  filtra por ele. **Não é ponta solta**: eles servem operação com mais de
  uma pessoa, o que depende da gestão de membros acima. Quando ela existir,
  ligar os filtros é trabalho de minutos. Consequência hoje: a coluna
  "Responsável" na tabela de leads sempre exibe `—`.

- **Código morto encontrado na mesma varredura** (remoção trivial, sem
  impacto): `tasksService.get`, `proposalsService.get`,
  `pipelinesService.get`, o hook `useAudit` (só o `useAudits` plural é
  usado) e `useMediaQuery`.

## API — Leads & CRM

Todas as rotas abaixo exigem `Authorization: Bearer <accessToken>` (ver
[Autenticação](./docs/ARCHITECTURE.md#autenticação)) e checam permissão via
RBAC. Listagens aceitam `?page=&pageSize=` (paginação) e devolvem
`{ items, page, pageSize, total, totalPages }`.

| Recurso    | Rotas                                                                                                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empresas   | `POST/GET /api/v1/companies`, `GET/PATCH /:id`, `POST/DELETE /:id/websites[/:websiteId]`, `POST/DELETE /:id/socials[/:socialId]`                                                        |
| Leads      | `POST/GET /api/v1/leads`, `GET/PATCH /:id`, `PATCH /:id/stage`, `POST/DELETE /:id/contacts[/:contactId]`, `POST /:id/notes`, `POST/DELETE /:id/tags[/:tagId]`, `GET /:id/activities`    |
| Etiquetas  | `GET/POST /api/v1/tags`                                                                                                                                                                 |
| Pipelines  | `GET/POST /api/v1/pipelines`, `GET /:id`, `POST /:id/stages`                                                                                                                            |
| Tarefas    | `POST/GET /api/v1/tasks`, `GET/PATCH/DELETE /:id`                                                                                                                                       |
| Reuniões   | `POST/GET /api/v1/meetings`, `GET/PATCH /:id`, `POST/DELETE /:id/attendees[/:attendeeId]`                                                                                               |
| Propostas  | `POST/GET /api/v1/proposals`, `GET/PATCH /:id`                                                                                                                                          |
| Auditorias | `POST /api/v1/audits` (202 -- processa via worker), `GET /api/v1/audits[?companyId=&status=]`, `GET /:id`                                                                               |
| IA         | `GET /api/v1/ai/status`, `POST /api/v1/ai/leads/:id/score`, `POST .../report`, `POST .../message`, `POST /api/v1/ai/creative-direction` (503 sem `ANTHROPIC_API_KEY`)                   |
| Mensagens  | `GET /api/v1/messages[?leadId=&status=&channel=]`, `PATCH /:id`, `GET/POST /api/v1/messages/templates`, `PATCH /templates/:id`                                                          |
| Contratos  | `POST/GET /api/v1/contracts`, `GET /kpis`, `GET /:id[/pdf]`, `PATCH /:id/status`, `POST /:id/reprocess` -- públicas: `POST /api/v1/public/contracts`, `POST /api/v1/webhooks/signature` |

Detalhes de design que valem saber antes de consumir essa API:

- **`PATCH /leads/:id/stage`** é o único jeito de mover um lead no
  pipeline -- atualiza `status`/`closedAt` automaticamente com base em
  `PipelineStage.isWon`/`isLost` do estágio de destino, e grava uma
  `Activity` do tipo `STATUS_CHANGE` na timeline do lead.
- **Lead sem `pipelineStageId` no create** cai automaticamente no primeiro
  estágio do pipeline padrão da organização.
- **`Activity`** (timeline de um lead) é só leitura via API -- é gerada
  como efeito colateral de outras ações (criar lead, mover estágio,
  adicionar nota, enviar proposta), nunca criada diretamente.
- **Cascades de segurança**: apagar um `Lead` com Propostas/Mensagens/
  Reuniões vinculadas é bloqueado no banco (`Restrict`) -- ver
  [docs/DATABASE.md](./docs/DATABASE.md).
