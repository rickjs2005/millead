# MilLead (CRM interno MilWeb)

Tipo: sistema
Stack: Next.js 15 + React 19 + TypeScript, Express, PostgreSQL (Prisma), Redis (BullMQ), pnpm + Turborepo, Clean Architecture multi-tenant

## Progresso
Fase 01 — Descoberta e arquitetura     ✓  (Clean Architecture documentada, roadmap de 8 fases concluído segundo o README)
Fase 02 — UX/UI                        ✓  (frontend cobre todos os módulos, dashboard funcional)
Fase 03 — Modelagem do banco           ✓  (migrations em packages/database/prisma, multi-tenant via `organizationId`)
Fase 04 — Backend                      ✓  (domain/application/infrastructure/interfaces, health checks, rate-limit middleware)
Fase 05 — Autenticação e autorização   ◐  (seed cria "papéis padrão"; não confirmei nesta sessão o middleware de autorização por papel — verificar antes de marcar ✓)
Fase 06 — Frontend                     ✓  (todos os módulos consomem `apps/web/src/services`)
Fase 07 — Integrações                  ◐  (ZapSign/contratos, IA Claude, Instagram/MilSocial existem; memória registra pendência antiga de bug de e-mail na Autentique/ZapSign — não reverificado)
Fase 08 — Segurança                    ◐  (JWT + rate-limit presentes; memória cita achados de segurança "baixos" pendentes em millead-pendencias-seguranca.md — não reverificados)
Fase 09 — Testes                       ◐  (26/08: 465 testes na API + 174 no web + 56 no runner + 21 em video-contracts, todos passando; falta confirmar cobertura de E2E dos fluxos públicos — briefing e fechamento de contrato)
Fase 10 — Performance                  ○  (não verificado nesta sessão)
Fase 11 — Observabilidade              ◐  (health checks + logger existem; nenhuma ferramenta de error tracking tipo Sentry identificada — gap real)
Fase 12 — Infraestrutura               ✓  (Render blueprint p/ API, Vercel p/ web, Supabase, Upstash, CI em .github/workflows/ci.yml)
Fase 13 — QA final                     ○  (não rodado nesta sessão)
Fase 14 — Deploy                       ✓  (millead.milweb.com.br + millead-api.onrender.com no ar, conforme memória e render.yaml)
Fase 15 — SEO para páginas públicas    ◐  (CRM é login-only; confirmar se a tela de login/marketing, se existir, tem noindex — não assumir N/A sem checar)
Fase 16 — Pós-lançamento               ◐  (keep-api-awake.yml mitiga cold start do free tier; milsocial-sync.yml roda diário; sem monitoramento de erro/uptime de terceiros identificado)

## Trabalho de 26/08/2026 — Automação pós-fechamento
Implementada de ponta a ponta na branch `feat/post-sale-automation` (commit
`06a063c`, **não enviado**): contrato ASSINADO dispara lead ganho +
recebimentos + briefing + projeto + tarefas, via fila pg-boss, idempotente no
reenvio do webhook. Configuração por organização em Configurações > Automação
(nasce desligada) e card de acompanhamento no detalhe do contrato.
Spec: `docs/superpowers/specs/2026-08-26-post-sale-automation-design.md`.

Descobertas relevantes da investigação:
- A fila é **pg-boss no Postgres**, não BullMQ+Redis (trocada em 21/07/2026).
  README/ARCHITECTURE/DATABASE ainda descreviam o antigo — corrigidos.
- **Gestão de equipe realmente não existe** (`settings/team` é EmptyState).
  Foi adicionado só um `GET /settings/members` somente-leitura, necessário pro
  seletor de responsável padrão.

**Mergeada na `main` e no ar** (commit `922f06f`, verificado em produção:
`/health` reporta o commit certo, `/health/ready` ok, rotas novas respondem
401 em vez de 404). Migrations aplicadas (22).

No merge foi preciso integrar com a **gestão de equipe** (PR #2), que entrou
na main enquanto esta fase era construída: `GET /settings/members` foi
removido (duplicata de `GET /team/directory`), o formulário passou a usar o
`MemberSelect` do módulo de equipe, e a execução passou a resolver o
responsável validando membro ativo — sem isso, um responsável suspenso depois
de configurado derrubaria a etapa de tarefas inteira.

**Incidente 26/08/2026 — banco de produção apagado.** Durante a geração do SQL
da migration, `prisma migrate diff --shadow-database-url` foi rodado com a
`DATABASE_URL` de produção. Esse flag RESETA o banco apontado (dropa/recria o
schema `public`): todos os dados do Supabase de produção foram perdidos.
Supabase Free não tem backup automático, então não houve restore. Recuperação
feita: baseline das 21 migrations (`migrate resolve --applied`), `ensure-rls`
e `db:seed`. Produção verificada de pé (`/health/ready` ok, login responde 401
a senha errada). Perda real assumida pelo Rick: um briefing do KPM USA.
Armadilha documentada em `docs/DATABASE.md` (seção Workflow).

## Bloqueios
- Pendências registradas em memória (`millead-pendencias-seguranca`) ainda em aberto: ZapSign não configurado no Render (contratos não são assináveis de verdade em produção), 2 achados baixos de segurança (landing de IA sem sanitização própria, tokens em localStorage), permissões próprias de Contratos/Landing pages pendentes de migração.

## Próxima ação
Autorizar o deploy da automação pós-fechamento (migration + push + Render/Vercel)
e ligá-la em Configurações > Automação. Depois disso, os dois gaps concretos sem
dependência externa continuam sendo RBAC (Fase 05) e Observabilidade (Fase 11).
As pendências de `millead-pendencias-seguranca` (ZapSign, achados baixos)
dependem de decisão do Rick sobre configuração no Render.

## Notas de N/A
- (nenhuma até o momento — Fase 15 propositalmente não marcada N/A sem confirmar antes)
