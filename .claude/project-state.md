# MilLead (CRM interno MilWeb)

Tipo: sistema
Stack: Next.js 15 + React 19 + TypeScript, Express, PostgreSQL (Prisma), pg-boss (fila no proprio Postgres), pnpm + Turborepo, Clean Architecture multi-tenant

## Progresso
Fase 01 — Descoberta e arquitetura     ✓  (Clean Architecture documentada, roadmap de 8 fases concluído segundo o README)
Fase 02 — UX/UI                        ✓  (frontend cobre todos os módulos, dashboard funcional)
Fase 03 — Modelagem do banco           ✓  (migrations em packages/database/prisma, multi-tenant via `organizationId`)
Fase 04 — Backend                      ✓  (domain/application/infrastructure/interfaces, health checks, rate-limit middleware)
Fase 05 — Autenticação e autorização   ✓  (27/08 verificado: `requirePermission` em todas as rotas de negócio, permissões resolvidas do banco a cada request, e a gestão de equipe fechou o ciclo — papéis custom, membro suspenso e bloqueio de escalada de privilégio)
Fase 06 — Frontend                     ✓  (todos os módulos consomem `apps/web/src/services`)
Fase 07 — Integrações                  ◐  (ZapSign/contratos, IA Claude, Instagram/MilSocial existem; memória registra pendência antiga de bug de e-mail na Autentique/ZapSign — não reverificado)
Fase 08 — Segurança                    ◐  (JWT + rate-limit presentes; memória cita achados de segurança "baixos" pendentes em millead-pendencias-seguranca.md — não reverificados)
Fase 09 — Testes                       ◐  (27/08: 477 API + 182 web + 56 runner + 21 video-contracts = 736, todos passando. DOIS gaps confirmados: (a) o CI **não roda testes** — ci.yml só faz format/lint/type-check/build; (b) nenhum E2E dos fluxos públicos (/b/:token, /p/:token, /fechamento/:slug))
Fase 10 — Performance                  ○  (não verificado nesta sessão)
Fase 11 — Observabilidade              ◐  (27/08 reverificado: health checks + pino existem; **zero** error tracking — nenhum Sentry/equivalente em nenhum package.json. Erro em produção só aparece se alguém abrir o log do Render)
Fase 12 — Infraestrutura               ✓  (Render blueprint p/ API, Vercel p/ web, Supabase, Upstash, CI em .github/workflows/ci.yml)
Fase 13 — QA final                     ○  (não rodado nesta sessão)
Fase 14 — Deploy                       ✓  (millead.milweb.com.br + millead-api.onrender.com no ar, conforme memória e render.yaml)
Fase 15 — SEO para páginas públicas    ◐  (27/08 checado: **não é N/A**. Não existe robots.txt nem robots.ts, e não há `noindex` em lugar nenhum — mas existem 3 rotas públicas sem login com dado de cliente: /b/:token (briefing), /p/:token (proposta com valor) e /fechamento/:slug. Aqui o objetivo é o INVERSO de SEO: impedir indexação)
Fase 16 — Pós-lançamento               ◐  (keep-api-awake.yml mitiga cold start do free tier; milsocial-sync.yml roda diário; sem monitoramento de erro/uptime de terceiros identificado)

## Trabalho de 26/08/2026 — Automação pós-fechamento
Implementada de ponta a ponta (commit `06a063c`): contrato ASSINADO dispara lead ganho +
recebimentos + briefing + projeto + tarefas, via fila pg-boss, idempotente no
reenvio do webhook. Configuração por organização em Configurações > Automação
(nasce desligada) e card de acompanhamento no detalhe do contrato.
Spec: `docs/superpowers/specs/2026-08-26-post-sale-automation-design.md`.

Descobertas relevantes da investigação:
- A fila é **pg-boss no Postgres**, não BullMQ+Redis (trocada em 21/07/2026).
  README/ARCHITECTURE/DATABASE ainda descreviam o antigo — corrigidos.
- **Gestão de equipe não existia no commit de origem da branch**, mas entrou
  na `main` (PR #2) durante o trabalho — ver a nota de merge abaixo.

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

## Trabalho de 26/08/2026 — Painel (evolução, não tela nova)
Commit `2c3b035`, no ar. Decisão: evoluir o dashboard existente em vez de criar
uma central "Hoje" — ele já tinha 12 componentes (tarefas, reuniões,
atividades), e uma tela nova duplicaria isso. Entrou só o que a automação
passou a produzir e não tinha tela:
- Card "Pós-fechamento pendente" (`GET /api/v1/contracts/post-sale/pending`) —
  única visão agregada das automações que pararam, com reprocessar inline.
- Card "Prazos de projeto" — usa o `dueAt` gravado pela automação; filtro
  puro no cliente (`features/dashboard/project-deadlines.ts`, testado).
- Toggle "Equipe / Minhas" nos cards de tarefa, escondido quando a org tem
  uma pessoa só.

## Trabalho de 27/08/2026 — Cofre Financeiro (Fase 1 de 10)

Branch `feat/cofre-financeiro`, **não mergeada, não deployada**. Módulo de
financas pessoais do dono, isolado do financeiro da MilWeb. Esta fase entregou
so a seguranca; o resto (contas, cartoes, transacoes, importacao OFX/CSV,
classificacao, assinaturas, dividas, ponte com o Centro de Custos, dashboard,
exportacao) sao as fases 2-10. Doc: `docs/personal-finance-vault.md`.

Tres achados que mudaram o desenho, encontrados lendo o codigo antes de codar:

1. **RBAC vazaria o Cofre.** `ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(k => k
   !== BILLING_MANAGE)` — qualquer chave nova entra sozinha no papel Admin de
   toda organizacao. O modulo nao usa permissao nenhuma: autorizacao e posse
   (`PersonalVault.ownerUserId` unique) + sessao elevada.
2. **`PushSender` so tem `sendToOrg`** — alerta de assinatura pessoal iria pro
   navegador de toda a equipe. Precisa de `sendToUser` na Fase 5.
3. **`audit-mutations` grava toda mutacao no AuditLog da organizacao** —
   excluido `/api/v1/vault/*`; o Cofre audita com `organizationId: null` e sem
   valores.

Decisoes do Rick nesta sessao: cada usuario cria o seu Cofre (nao ha e-mail
hard-coded; o gate `require-owner.ts`/`OWNER_EMAIL` do MilSocial NAO foi
reusado); e migration gerada e aplicada direto na producao, por ela estar
vazia (verificado: 1 usuario do seed, 0 dados de negocio).

Migration `20260827120000_add_personal_vault` **aplicada em producao**
(aditiva: 1 CREATE TABLE, RLS habilitado, nenhum ALTER/DROP; verificado que
nada foi perdido). 41 testes novos, 518 no total na API, type-check/lint/build
limpos.

**Achado lateral, nao corrigido:** `pnpm format` reformata ~120 arquivos que
nada tem a ver com esta tarefa (alinhamento de tabela em Markdown, linha em
branco antes de lista). Ou seja, `format:check` ja falha na `main` — o CI
provavelmente esta vermelho por isso. Reverti os arquivos nao relacionados
para nao poluir a branch; consertar isso e uma tarefa a parte.

## Bloqueios
- Pendências registradas em memória (`millead-pendencias-seguranca`) ainda em aberto: ZapSign não configurado no Render (contratos não são assináveis de verdade em produção), 2 achados baixos de segurança (landing de IA sem sanitização própria, tokens em localStorage), permissões próprias de Contratos/Landing pages pendentes de migração.

## Próxima ação

**Fase 2 do Cofre** (contas, cartoes, categorias, fornecedores, transacoes,
splits, faturas) na branch `feat/cofre-financeiro`. Antes de usar a Fase 1 e
preciso definir `VAULT_SESSION_SECRET` no `.env` e no Render — sem ela o
modulo inteiro responde 404 de proposito.

### Pendencias anteriores (verificadas em 27/08)
**Ligar a automação**: Configurações > Automação (estágio de ganho "Fechado",
responsável, template `institucional-v1`, tipo de projeto, parcelas/prazos).
Nada dispara enquanto ela estiver desligada — é o default.

Depois disso, na ordem de custo/benefício (verificado em 27/08):

1. **`noindex` nas 3 rotas públicas + robots.txt** (~30min). Hoje /b/:token,
   /p/:token e /fechamento/:slug são indexáveis. São páginas sem login com
   nome, telefone e valor de cliente — o risco não é SEO ruim, é vazamento.
2. **CI rodar os testes** (~10min). São 736 testes que o ci.yml nunca executa;
   uma regressão passa direto pro merge hoje.
3. **Error tracking** (~2h). Zero hoje: erro em produção só aparece se alguém
   abrir o log do Render. Sentry free ou equivalente.
4. **E2E dos fluxos públicos** (~4h). São os únicos caminhos sem login e sem
   teste de ponta a ponta.
5. Follow-ups/cadências — próxima fase de produto (ver o roadmap em
   `docs/superpowers/plans/2026-08-26-post-sale-automation.md`).

As pendências de `millead-pendencias-seguranca` (ZapSign no Render, achados
baixos) continuam dependendo de decisão do Rick.

## Notas de N/A
- (nenhuma até o momento — Fase 15 propositalmente não marcada N/A sem confirmar antes)
