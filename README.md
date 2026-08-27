# MilLead

CRM e prospecção de leads para a MilWeb. **Todo o roadmap original
implementado**: fundação, auth, Leads, CRM/Pipeline, auditoria de sites,
IA com Claude (score, mensagens, relatórios), diretor criativo, contratos,
briefings, financeiro e checklist de projetos. Desde 26/08/2026 o fluxo
comercial também é **automatizado depois do fechamento**: contrato assinado
marca o lead como ganho, prepara os recebimentos, cria o briefing e o projeto
e abre as próximas tarefas — ver
[Automação pós-fechamento](#automação-pós-fechamento). O frontend cobre todos
os módulos e consome a API via `apps/web/src/services`. Os recursos de IA
exigem `ANTHROPIC_API_KEY` no `.env`. Ver
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) e
[docs/DATABASE.md](./docs/DATABASE.md) para os detalhes técnicos.

## Stack

Next.js 15 · React 19 · TypeScript · Node.js · Express · PostgreSQL ·
Prisma · pg-boss (fila no próprio Postgres) · pnpm workspaces + Turborepo.

Arquitetura: Clean Architecture (domain/application/infrastructure/
interfaces) num monólito modular, multi-tenant (shared schema + coluna
discriminadora `organizationId`).

## Quickstart

Pré-requisitos: Node ≥22, pnpm ≥10. **Não precisa de Docker nem de Redis**:
em dev o Postgres roda no [Supabase](https://supabase.com) (free tier) e a
fila de jobs vive no próprio Postgres (pg-boss, schema `pgboss`, criado
sozinho no primeiro start) — veja o formato da URL no `.env.example`. Quem
preferir infra local pode usar o `docker-compose.yml`, que continua no
repositório como alternativa.

```bash
cp .env.example .env          # preencha DATABASE_URL e os segredos JWT
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
`SELECT 1` falhar).

`GET /health` responde `{"status":"ok","commit":"6eec5df","startedAt":"..."}`.
O `commit` é o SHA curto do código em execução (`RENDER_GIT_COMMIT`, que o
Render injeta sozinho; `dev` fora de um deploy) e o `startedAt` denuncia
restart e cold start. **Use os dois antes de investigar comportamento novo
que "não subiu"**: web (Vercel) e API (Render) deployam separado, então é
comum o front já ter a mudança e a API ainda não.

Pra rodar o worker de filas separadamente:

```bash
pnpm --filter @millead/api dev:worker
```

> **Sem o worker rodando, nada sai da fila**: auditoria de site, PDF/convite
> de contrato, PDF de briefing e a automação pós-fechamento ficam
> enfileirados até alguém subir o processo. Em produção (Render free, um
> serviço só) o `START_WORKERS=true` sobe os workers dentro da própria API —
> o nome da env var ainda diz "BullMQ" em comentários antigos, mas a fila é
> pg-boss desde 21/07/2026.

### Notas sobre o Supabase

- Use sempre a connection string do **session pooler** (porta 5432 em
  `aws-1-sa-east-1.pooler.supabase.com`) — a conexão direta
  (`db.<ref>.supabase.co`) é IPv6-only e não funciona na maioria das redes
  domésticas; o transaction pooler (porta 6543) não suporta migrations.
- O Supabase expõe o schema `public` numa API REST própria (PostgREST).
  Por isso **toda tabela tem RLS habilitado sem policies** — isso bloqueia
  o acesso externo sem afetar o app, que entra via Prisma como dono das
  tabelas. É recomendável que toda migration que criar tabela nova já
  inclua `ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;`, mas isso não é
  mais o único mecanismo de proteção: `pnpm db:migrate:deploy` roda
  `prisma/ensure-rls.sql` logo depois do `prisma migrate deploy` (dev e
  produção) e habilita RLS em qualquer tabela do schema `public` que ainda
  não tenha — mesmo que a migration tenha esquecido a linha. Isso existe
  porque a regra manual já foi esquecida 2x (17/08/2026: alerta crítico do
  Supabase Advisor em tabelas criadas fora do módulo Financeiro). O aviso
  INFO "RLS Enabled No Policy" nos advisors do Supabase é intencional.

## Scripts principais

| Comando                          | O que faz                                                               |
| -------------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                       | api + web em modo watch (via Turborepo)                                 |
| `pnpm build`                     | build de produção de tudo                                               |
| `pnpm lint` / `pnpm type-check`  | qualidade em todo o monorepo                                            |
| `pnpm db:studio`                 | GUI do Prisma pra inspecionar o banco                                   |
| `pnpm docker:up` / `docker:down` | sobe/derruba a infra local alternativa (opcional — o padrão é Supabase) |

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
- [x] **Fase 6 — Auditoria de sites**: fila `audit-site` (pg-boss), worker
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
      recurso), mais `/projetos` (checklist de projetos) e
      `/settings/automation`. A varredura de 28/07/2026 (que cruzou rotas da
      API com chamadas do front e achou 95 de 95 consumidas) **não foi
      refeita** desde então — os módulos financeiro, de checklist e a
      automação pós-fechamento entraram depois. Os endpoints deliberadamente
      sem chamada no navegador continuam sendo o
      `POST /api/v1/webhooks/signature` (chamado pelo provedor de assinatura)
      e as capacidades adormecidas listadas abaixo.

## Automação pós-fechamento

Primeira etapa da costura dos módulos num fluxo operacional único. Quando o
webhook confirma a assinatura de um contrato, o MilLead faz sozinho, em fila:

1. **Lead** → move pro estágio de ganho configurado (via `moveStage`, com
   `Activity` na timeline).
2. **Recebimentos** → entrada (do `percentualEntrada` do próprio contrato) +
   parcelas, com os prazos que você configurou.
3. **Briefing** → criado e vinculado ao lead, à empresa e ao contrato, com
   link público pronto. **Nada é enviado ao cliente** — quem envia é você.
4. **Projeto** → `ProjectChecklist` com as 16 fases do tipo escolhido, nomeado
   `Empresa — NÚMERO-DO-CONTRATO`, com início e prazo vindos do contrato.
5. **Tarefas** → confirmar entrada, revisar briefing, kickoff, validar prazo,
   iniciar a fase 1 — todas com responsável e link pro que precisa ser feito.

Configuração em **Configurações → Automação** (`settings:manage`). Nasce
**desligada**: ligar é decisão explícita, nada muda no comportamento atual até
você ativar.

Duas garantias que valem saber antes de usar:

- **A assinatura nunca é perdida.** A automação só roda depois de o contrato
  estar gravado como `ASSINADO`, e qualquer falha vira etapa pendente visível
  na tela do contrato — nunca um contrato "des-assinado" ou um webhook 500.
- **Nada é adivinhado.** Sem número de parcelas, prazos, template de briefing,
  tipo de projeto ou estágio de ganho configurados, a etapa correspondente
  **não escolhe um valor plausível**: ela abre uma tarefa acionável pra você
  decidir. Configure e clique "Reprocessar" — só as etapas pendentes rodam.

O reenvio do mesmo webhook (o provedor reenvia em erro) não duplica lead
movido, plano de recebimento, briefing, projeto nem tarefa: são três travas
de unicidade no banco mais um compare-and-swap de status.

O card **Pós-fechamento** no detalhe do contrato mostra o status, as 5 etapas,
o que falhou e links pro que foi criado, com botão de reprocessar
(`proposals:write`).

No **painel**, o card "Pós-fechamento pendente" lista as automações que
pararam no meio (de toda a organização, não uma por contrato) com botão de
reprocessar, e o card "Prazos de projeto" mostra os projetos perto de vencer
ou já atrasados — o prazo vem do contrato assinado.

Detalhes de design, estados, idempotência e como testar à mão:
[a spec](./docs/superpowers/specs/2026-08-26-post-sale-automation-design.md).

## Cofre Financeiro (área pessoal do dono da conta)

Área privada em `/cofre` para finanças pessoais, separada do financeiro da
MilWeb. **Fase 1 de 10 concluída**: toda a camada de segurança. Contas,
cartões, movimentações, importação de OFX/CSV, assinaturas, dívidas e a ponte
com o Centro de Custos entram nas fases seguintes.

O que já está de pé:

- **Não usa RBAC, de propósito.** `ADMIN_PERMISSIONS` é `ALL_PERMISSIONS`
  menos billing — uma permissão `vault:*` nova entraria sozinha no papel Admin
  de toda organização. A autorização é **posse** (`PersonalVault.ownerUserId`,
  unique) + **sessão elevada**. Cada usuário cria o seu Cofre; ninguém vê o de
  ninguém.
- **Reautenticação com a senha da conta**, sessão elevada própria de 15min de
  inatividade, com segredo separado do access token (`VAULT_SESSION_SECRET`;
  a API recusa subir em produção com os dois iguais).
- **"Bloquear agora" revoga no servidor**, não só limpa o cookie. Logout e
  troca de senha fecham o Cofre pelo mesmo caminho.
- **Lockout escalonado persistido no banco** (5 tentativas → 1/5/15/60 min),
  porque um contador em memória zeraria a cada cold start do Render free.
- **404, nunca 403**: quem não é dono não descobre que o Cofre existe.
- **Auditoria fora da trilha da organização** (`organizationId` null) e sem
  nenhum valor financeiro.

Requer `VAULT_SESSION_SECRET` no `.env` — sem ela o módulo inteiro responde
404 (fecha, não degrada). Design completo, decisões e roadmap em
[docs/personal-finance-vault.md](./docs/personal-finance-vault.md).

## Gestão de equipe

- [x] Convites por e-mail/link com token opaco, hash no banco, expiração em
      7 dias, reenvio e revogação.
- [x] Membros ativos/suspensos, papéis padrão e personalizados e proteção do
      último Owner ativo.
- [x] Escalada de privilégio bloqueada: ninguém pode conceder permissões que
      não possui, nem atribuir um usuário de outro tenant.
- [x] Responsável em leads e tarefas, com diretório da equipe e filtros
      “Meus leads”/“Minhas tarefas”. A automação pós-fechamento atribui o
      responsável padrão configurado a toda tarefa que cria.

- **Código morto encontrado na mesma varredura** (remoção trivial, sem
  impacto): `tasksService.get`, `proposalsService.get`,
  `pipelinesService.get`, o hook `useAudit` (só o `useAudits` plural é
  usado) e `useMediaQuery`.

## API — Leads & CRM

Todas as rotas abaixo exigem `Authorization: Bearer <accessToken>` (ver
[Autenticação](./docs/ARCHITECTURE.md#autenticação)) e checam permissão via
RBAC. Listagens aceitam `?page=&pageSize=` (paginação) e devolvem
`{ items, page, pageSize, total, totalPages }`.

| Recurso | Rotas |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| Empresas | `POST/GET /api/v1/companies`, `GET/PATCH /:id`, `POST/DELETE /:id/websites[/:websiteId]`, `POST/DELETE /:id/socials[/:socialId]` |
| Leads | `POST/GET /api/v1/leads`, `GET/PATCH /:id`, `PATCH /:id/stage`, `POST/DELETE /:id/contacts[/:contactId]`, `POST /:id/notes`, `POST/DELETE /:id/tags[/:tagId]`, `GET /:id/activities` |
| Etiquetas | `GET/POST /api/v1/tags` |
| Pipelines | `GET/POST /api/v1/pipelines`, `GET /:id`, `POST /:id/stages` |
| Tarefas | `POST/GET /api/v1/tasks`, `GET/PATCH/DELETE /:id` |
| Reuniões | `POST/GET /api/v1/meetings`, `GET/PATCH /:id`, `POST/DELETE /:id/attendees[/:attendeeId]` |
| Propostas | `POST/GET /api/v1/proposals`, `GET/PATCH /:id` |
| Auditorias | `POST /api/v1/audits` (202 -- processa via worker), `GET /api/v1/audits[?companyId=&status=]`, `GET /:id` |
| IA | `GET /api/v1/ai/status`, `POST /api/v1/ai/leads/:id/score`, `POST .../report`, `POST .../message`, `POST /api/v1/ai/creative-direction` (503 sem `ANTHROPIC_API_KEY`) |
| Mensagens | `GET /api/v1/messages[?leadId=&status=&channel=]`, `PATCH /:id`, `GET/POST /api/v1/messages/templates`, `PATCH /templates/:id` |
| Contratos | `POST/GET /api/v1/contracts`, `GET /kpis`, `GET /post-sale/pending`, `GET /:id[/pdf]`, `PATCH /:id/status`, `POST /:id/reprocess`, `GET /:id/post-sale`, `POST /:id/post-sale/reprocess` -- públicas: `POST /api/v1/public/contracts`, `POST /api/v1/webhooks/signature` |
| Equipe | `GET /api/v1/team/directory`, membros, convites e papéis em `/api/v1/team/*`; públicas: `POST /api/v1/public/team-invitations/preview                                                   | accept` |
| Configurações | `GET /api/v1/settings/integrations`, `PATCH /profile`, `PATCH /organization`, `GET/PATCH /post-sale-automation` |

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
