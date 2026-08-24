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
Fase 09 — Testes                       ◐  (270 testes unitários passando em 08/08 segundo a memória; falta confirmar cobertura de E2E dos fluxos públicos — briefing e fechamento de contrato)
Fase 10 — Performance                  ○  (não verificado nesta sessão)
Fase 11 — Observabilidade              ◐  (health checks + logger existem; nenhuma ferramenta de error tracking tipo Sentry identificada — gap real)
Fase 12 — Infraestrutura               ✓  (Render blueprint p/ API, Vercel p/ web, Supabase, Upstash, CI em .github/workflows/ci.yml)
Fase 13 — QA final                     ○  (não rodado nesta sessão)
Fase 14 — Deploy                       ✓  (millead.milweb.com.br + millead-api.onrender.com no ar, conforme memória e render.yaml)
Fase 15 — SEO para páginas públicas    ◐  (CRM é login-only; confirmar se a tela de login/marketing, se existir, tem noindex — não assumir N/A sem checar)
Fase 16 — Pós-lançamento               ◐  (keep-api-awake.yml mitiga cold start do free tier; milsocial-sync.yml roda diário; sem monitoramento de erro/uptime de terceiros identificado)

## Bloqueios
- Pendências registradas em memória (`millead-pendencias-seguranca`) ainda em aberto: ZapSign não configurado no Render (contratos não são assináveis de verdade em produção), 2 achados baixos de segurança (landing de IA sem sanitização própria, tokens em localStorage), permissões próprias de Contratos/Landing pages pendentes de migração.

## Próxima ação
Fechar RBAC (Fase 05) e Observabilidade (Fase 11), que são os dois gaps concretos sem dependência de decisão externa. As pendências de `millead-pendencias-seguranca` (ZapSign, achados baixos) dependem de decisão do Rick sobre configuração no Render.

## Notas de N/A
- (nenhuma até o momento — Fase 15 propositalmente não marcada N/A sem confirmar antes)
