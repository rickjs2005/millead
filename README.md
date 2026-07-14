# MilLead

CRM e prospecção de leads para a MilWeb. **Todas as 8 fases do roadmap
implementadas**: fundação, auth, Leads, CRM/Pipeline, auditoria de sites
(BullMQ), IA com Claude (score, mensagens, relatórios) e landing pages
geradas por IA. O frontend cobre todos os módulos e consome a API via
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
`millead-dev-only` se a env var não for definida). Pra checar as
dependências: `GET http://localhost:4000/health/ready` responde
`{"checks":{"database":true,"redis":true}}`.

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

| Comando                         | O que faz                               |
| ------------------------------- | --------------------------------------- |
| `pnpm dev`                      | api + web em modo watch (via Turborepo) |
| `pnpm build`                    | build de produção de tudo               |
| `pnpm lint` / `pnpm type-check` | qualidade em todo o monorepo            |
| `pnpm db:studio`                | GUI do Prisma pra inspecionar o banco   |
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
- [x] **Fase 8 — Landing pages automáticas**: a IA gera uma página completa
      (HTML único, autocontido, sem JS/recursos externos) a partir dos dados
      da empresa + auditoria + brief do vendedor. Dois objetivos: **demo do
      site do prospect** ou **página de proposta** da agência. Geração roda
      na fila BullMQ (`landing-page`, 1-2 min); publicar gera URL pública
      `GET /p/:slug` (sem login, com contador de visitas). UI em
      `/landing-pages` (gerar, preview, publicar, copiar link, regenerar).
      Requer `ANTHROPIC_API_KEY` **e o worker rodando**.
- [x] **Fase 9 — Contratos (migrado do milweb-contratos)**: fluxo completo
      de fechamento -> PDF jurídico (15 cláusulas, `pdf-lib`) -> assinatura
      eletrônica -> acompanhamento. Formulário público em
      `/fechamento/:orgSlug` (rate-limit por IP), numeração automática
      `MILWEB-AAAA-NNNNNN` por org+ano, PDFs guardados no banco, timeline
      de eventos, webhook de assinatura com HMAC. Provedor padrão: **mock**
      (simulado); ZapSign pronto via `SIGNATURE_PROVIDER=zapsign` + token.
      E-mail/WhatsApp opcionais via env. O contratante vira `Company` do
      CRM automaticamente (upsert por CPF/CNPJ). Requer o worker rodando.
- [ ] **Frontend (em andamento)**: telas de login/cadastro, dashboard,
      leads, CRM (kanban), agenda, reuniões, tarefas, propostas, mensagens
      e configurações já existem em `apps/web`, consumindo a API via
      `src/services` (um serviço por recurso). Falta terminar/polir os
      fluxos e cobrir os módulos das Fases 6+ quando existirem.

## API — Leads & CRM

Todas as rotas abaixo exigem `Authorization: Bearer <accessToken>` (ver
[Autenticação](./docs/ARCHITECTURE.md#autenticação)) e checam permissão via
RBAC. Listagens aceitam `?page=&pageSize=` (paginação) e devolvem
`{ items, page, pageSize, total, totalPages }`.

| Recurso   | Rotas                                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Empresas  | `POST/GET /api/v1/companies`, `GET/PATCH /:id`, `POST/DELETE /:id/websites[/:websiteId]`, `POST/DELETE /:id/socials[/:socialId]`                                                     |
| Leads     | `POST/GET /api/v1/leads`, `GET/PATCH /:id`, `PATCH /:id/stage`, `POST/DELETE /:id/contacts[/:contactId]`, `POST /:id/notes`, `POST/DELETE /:id/tags[/:tagId]`, `GET /:id/activities` |
| Etiquetas | `GET/POST /api/v1/tags`                                                                                                                                                              |
| Pipelines | `GET/POST /api/v1/pipelines`, `GET /:id`, `POST /:id/stages`                                                                                                                         |
| Tarefas   | `POST/GET /api/v1/tasks`, `GET/PATCH/DELETE /:id`                                                                                                                                    |
| Reuniões  | `POST/GET /api/v1/meetings`, `GET/PATCH /:id`, `POST/DELETE /:id/attendees[/:attendeeId]`                                                                                            |
| Propostas | `POST/GET /api/v1/proposals`, `GET/PATCH /:id`                                                                                                                                       |
| Auditorias | `POST /api/v1/audits` (202 -- processa via worker), `GET /api/v1/audits[?companyId=&status=]`, `GET /:id`                                                                           |
| IA        | `GET /api/v1/ai/status`, `POST /api/v1/ai/leads/:id/score`, `POST .../report`, `POST .../message` (503 sem `ANTHROPIC_API_KEY`)                                                      |
| Mensagens | `GET /api/v1/messages[?leadId=&status=&channel=]`, `PATCH /:id`, `GET/POST /api/v1/messages/templates`, `PATCH /templates/:id`                                                       |
| Landing pages | `POST/GET /api/v1/landing-pages`, `GET /:id`, `POST /:id/regenerate`, `POST /:id/publish`, `DELETE /:id` -- pública: `GET /p/:slug`                                              |
| Contratos | `POST/GET /api/v1/contracts`, `GET /kpis`, `GET /:id[/pdf]`, `PATCH /:id/status`, `POST /:id/reprocess` -- públicas: `POST /api/v1/public/contracts`, `POST /api/v1/webhooks/signature` |

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
