# Automação pós-fechamento — plano de implementação

Spec: [2026-08-26-post-sale-automation-design.md](../specs/2026-08-26-post-sale-automation-design.md)

Status: **concluído** (branch `feat/post-sale-automation`).

## Tarefas

### 1. Banco — `20260826120000_add_post_sale_automation` ✓

- 6 enums (`automation_event_type`, `automation_trigger`,
  `automation_execution_status`, `automation_step_key`,
  `automation_step_status`, `automation_artifact_type`).
- 4 tabelas: `post_sale_automation_settings`, `automation_executions`,
  `automation_steps`, `automation_artifacts` — todas com `organization_id`,
  índices e RLS.
- Colunas aditivas nullable: `briefings.contract_id`;
  `project_checklists.lead_id` / `contract_id` (UNIQUE) / `started_at` /
  `due_at`.
- Nenhuma migration antiga editada; nenhuma operação destrutiva.
- Verificado com `prisma migrate diff --exit-code`: **No difference detected**
  entre as migrations e o schema.

### 2. Domínio ✓

- `domain/entities/post-sale-automation.ts` — entidades + `AUTOMATION_STEP_ORDER`.
- `domain/repositories/post-sale-automation-repository.ts` — contrato do agregado.
- `domain/services/post-sale-queue.ts` — porta da fila.
- Extensões: `ProjectChecklist` (+`leadId`/`contractId`/`startedAt`/`dueAt`),
  `Briefing` (+`contractId`), `BriefingRepository` (+`findFirstByContractId`),
  `ProjectChecklistRepository` (+`findByContractId`).

### 3. Infraestrutura ✓

- `prisma-post-sale-automation-repository.ts` — upserts idempotentes
  (`update: {}` deliberado nos dois upserts: reencontrar não é reabrir) e o
  CAS de `claimExecution`.
- `pg-post-sale-queue.ts` — fila `post-sale-onboarding` com `singletonKey`.
- Repositórios existentes estendidos (briefing, project-checklist, membership).

### 4. Aplicação ✓

- `post-sale-onboarding-service.ts` — o orquestrador (5 etapas isoladas,
  `resolveExecutionStatus` e `dueDateFrom` puros e exportados pra teste).
- `post-sale-settings-service.ts` — configuração + validação de tenant +
  `missingConfig`.
- `contract-service.ts` — `trigger` após `markSigned`, com `try/catch` externo.
- `lead-service.ts` — `moveStage` aceita autor `null`.
- `briefing-service.ts` — `create` aceita `contractId`; `findByContract`.
- `project-checklist-service.ts` — valida `leadId`/`contractId` contra o
  tenant; `findByContract`.

### 5. Interfaces ✓

- `post-sale-controller.ts`; rotas em `settings-routes.ts` (`settings:manage`)
  e `contract-routes.ts` (`proposals:read`/`write`).
- `interfaces/jobs/post-sale.worker.ts`, registrado no `jobs/index.ts`.
- `main/post-sale-factory.ts` — grafo compartilhado entre API e worker (sem
  ele, o worker recriaria à mão a mesma dúzia de repositórios e a próxima
  dependência entraria só num dos dois lados).

### 6. Frontend ✓

- `services/post-sale.ts`, `features/post-sale/hooks.ts`,
  `features/post-sale/labels.ts`.
- `features/post-sale/components/post-sale-settings.tsx` → `/settings/automation`.
- `features/post-sale/components/post-sale-card.tsx` → detalhe do contrato.
- Novos rótulos de evento em `contract-labels.ts`; item "Automação" no menu
  de Configurações.

### 7. Testes ✓

`apps/api` 406 → **465**; `apps/web` 168 → **174**.

### 8. Documentação ✓

README, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, spec e este plano.
`.env.example` **não** mudou: a automação é configurada por organização no
banco, não por env var.

## Verificação executada

| Comando | Resultado |
| --- | --- |
| `pnpm db:generate` | ✓ |
| `prisma migrate diff --exit-code` | ✓ sem drift |
| `pnpm --filter @millead/api test` | ✓ 465 passaram |
| `pnpm --filter @millead/web test` | ✓ 174 passaram |
| `pnpm type-check` | ✓ |
| `pnpm lint` | ✓ (1 warning pré-existente em `proposal-service.test.ts:349`, não relacionado) |
| `pnpm build` | ✓ |

## Roadmap — próximas fases (não implementadas)

Ordenadas por dependência e por quanto se apoiam no que esta fase criou.

1. **Central "Hoje"** — uma tela que junta tarefas vencendo, parcelas a
   receber, briefings parados e projetos com prazo apertado. É a primeira
   beneficiária direta desta fase: a automação passou a *produzir* as tarefas
   e os prazos que essa tela consumiria. Não precisa de schema novo.
2. **Follow-ups e cadências** — sequência de toques automáticos por estágio
   do pipeline. Reusa a mesma infraestrutura de execução/etapa/artefato desta
   fase, trocando o gatilho de "contrato assinado" por "lead parado há N dias".
   É aqui que `AutomationEventType` ganha o segundo valor.
3. **Evolução do módulo Projetos** — o `ProjectChecklist` acabou de ganhar
   `leadId`, `contractId`, `startedAt` e `dueAt` sem nenhuma tela que os
   mostre. Exibir prazo, atraso e o contrato de origem é o menor passo com
   maior retorno.
4. **Forecast comercial** — valor ponderado por estágio, previsão de caixa
   cruzando pipeline e recebimentos. Depende de os leads terem estágio e
   valor consistentes, o que a etapa `LEAD_WON` ajuda a garantir.
5. **Importação de leads e deduplicação** — CSV/planilha com merge por
   documento/e-mail. Independente das outras; é volume de entrada do funil.
6. **WhatsApp, e-mail e calendário** — envio real (hoje a IA só gera rascunho
   e o briefing só gera link). Precisa de decisão de provedor e custo. É o que
   destravaria "enviar o briefing" virar etapa automática de verdade.
7. **Portal do cliente** — área logada onde o cliente acompanha contrato,
   parcelas, briefing e fases do projeto. Depende de 3 e 6.
8. **Pós-venda** — pesquisa de satisfação, renovação de manutenção,
   recorrência. É o fim do funil e depende de 1, 2 e 7 estarem de pé.

## Integração com a gestão de equipe (merge de 26/08/2026)

A `main` recebeu o módulo de gestão de equipe (PR #2) enquanto esta fase era
construída. O merge reconciliou:

- **`GET /settings/members` foi removido** — era duplicata de
  `GET /api/v1/team/directory`, que já existe e é visível a qualquer usuário
  autenticado (o meu exigia `settings:manage`, restritivo demais pra um
  seletor). O formulário de automação passou a usar o componente
  `MemberSelect` do módulo de equipe.
- **`isActiveMember` ficou com a implementação da equipe**, que é mais
  estrita: checa também `user.isActive`, não só o status do vínculo.
- **`LeadService` e `TaskService` ganharam `MembershipRepository`** e passaram
  a validar o responsável; a fábrica da automação foi atualizada e a execução
  agora resolve o responsável antes de usá-lo (ver a spec).
