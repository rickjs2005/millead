# Banco de dados — MilLead

Schema completo em [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma).
Convenção: modelos Prisma em PascalCase/camelCase, tabelas/colunas em
snake_case no Postgres real (via `@@map`/`@map`) — legível dos dois lados.

## Grupos de entidades

### 1. Identidade, acesso e multi-tenancy

`User` · `Organization` · `Membership` · `Role` · `Permission` ·
`RolePermission` · `RefreshToken` · `AuditLog`

- `User` não pertence a uma organização diretamente — o vínculo é sempre
  via `Membership` (N:N com `Role` por organização). Isso já deixa pronto
  o caso de um usuário atender mais de um workspace.
- `Permission` é catálogo **global** (não por tenant); `Role` é por
  organização. Ver `packages/database/src/permissions.ts` pra a lista
  completa e os 4 papéis padrão provisionados automaticamente
  (Owner/Admin/Sales/Viewer).
- `AuditLog` ≠ `Audit` (grupo 3) — ver [ARCHITECTURE.md](./ARCHITECTURE.md#auditoria-de-ações-vs-auditoria-de-site).

### 2. CRM: empresas, leads e pipeline

`Company` · `CompanyWebsite` · `CompanySocial` · `Lead` · `LeadContact` ·
`LeadNote` · `Tag` · `LeadTag` · `Pipeline` · `PipelineStage` · `Task` ·
`Activity` · `Meeting` · `MeetingAttendee` · `Proposal`

- **Decisão registrada**: o plano original listava só "lead_tags" como
  entidade. Modelei como catálogo (`Tag`, reutilizável por organização,
  com nome+cor) + tabela de junção (`LeadTag`) em vez de duplicar
  nome/cor em cada linha — permite renomear/recolorir uma etiqueta uma
  vez só e reaproveitar em vários leads. Se isso for overhead
  desnecessário pra Fase 4, é fácil de simplificar depois.
- `Activity` é o feed cronológico auto-gerado da timeline de um lead
  (o que **já aconteceu**) — diferente de `Task` (o que falta fazer) e de
  `AuditLog` (segurança/sistema, não é por lead).
- `MeetingAttendee` foi adicionado (não estava na lista original) porque
  uma reunião sem participantes estruturados não é consultável
  (“reuniões desse lead com esse contato”) — extensão mínima, não um
  módulo novo.
- `Lead.pipelineStageId` referencia `PipelineStage`; os estágios padrão
  (Novo Lead → Contato → Resposta → Reunião → Proposta → Fechado/Perdido)
  são criados pelo seed.

### 3. Auditoria de site (produto — Fase 6)

`Audit` · `AuditReport` · `AuditScore`

Schema modelado agora conforme pedido na Fase 2, lógica (fila `audit-site`,
scraping, scoring) só entra na Fase 6.

### 4. Mensageria (Fase 7)

`MessageTemplate` · `Message` · `MessageLog`

`Message.status` guarda o estado atual; `MessageLog` guarda o histórico
completo de eventos de entrega reportados pelo provedor (webhook).

### 5. Automação pós-fechamento

`PostSaleAutomationSettings` · `AutomationExecution` · `AutomationStep` ·
`AutomationArtifact`

Contrato assinado dispara lead ganho + recebimentos + briefing + projeto +
tarefas. Design completo em
[a spec](./superpowers/specs/2026-08-26-post-sale-automation-design.md).

- **Três tabelas de execução, não uma.** Cada uma responde a uma pergunta
  diferente e carrega uma trava de unicidade diferente — e é a trava, não a
  leitura, que faz o reenvio do webhook ser seguro:

  | Tabela | Unique | Pergunta |
  | --- | --- | --- |
  | `automation_executions` | `(organizationId, eventType, contractId)` | "este contrato já disparou?" |
  | `automation_steps` | `(executionId, key)` | "esta etapa já rodou?" |
  | `automation_artifacts` | `(executionId, key)` | "este artefato já foi criado?" |

  Um `result Json` no step cobriria a leitura mas não daria trava nenhuma.
- `AutomationArtifact.refId` **não é FK**: aponta pra tabelas diferentes
  conforme o `type` (lead, briefing, projeto, tarefa, plano). Se a entidade
  for apagada, o link na tela some — em vez de FK quebrada ou cascata
  surpresa.
- **Campos financeiros anuláveis SEM default** (`installmentCount`,
  `entryDueDays`, `firstInstallmentDueDays`): é decisão do dono, não do
  sistema. Nulo faz a etapa de recebimentos virar pendência com tarefa, nunca
  um chute. `enabled` nasce `false` — a migration não muda o comportamento de
  nenhuma organização existente.
- Colunas aditivas em tabelas existentes:
  - `briefings.contract_id` — **não** é unique: um contrato pode render mais
    de um briefing (duplicar/reenviar). A trava contra duplicata da automação
    é o artefato.
  - `project_checklists.contract_id` — **é UNIQUE**. Postgres aceita N nulos
    num unique de coluna anulável, então checklists manuais (contrato nulo)
    convivem sem colidir, e "projeto duplicado por contrato" fica impossível
    no banco.
  - `project_checklists.lead_id`, `started_at`, `due_at` — vínculo com o CRM
    e prazo derivado de dado confiável do contrato (`assinadoEm` +
    `prazoEntregaDias`).
- **`tasks` NÃO ganhou `contract_id`** de propósito: é tabela quente usada por
  todo o CRM, e o vínculo forte já vive em `automation_artifacts`. A
  referência ao contrato vai na descrição da tarefa (com link).

### 6. Billing

`Subscription` — genérico o bastante pra qualquer provedor de pagamento
(Stripe ou não); nenhuma integração escolhida ainda.

## Estratégia multi-tenant no schema

Toda tabela de tenant carrega `organizationId` com `@@index([organizationId])`
(ou composto, quando faz sentido pra uma query comum). Isso é só a
metade do isolamento — a outra metade é disciplina na camada de
aplicação: **nenhum repositório pode aceitar um `organizationId` vindo
direto do cliente**, sempre do contexto autenticado. Ver
[ARCHITECTURE.md](./ARCHITECTURE.md#multi-tenant-shared-schema--coluna-discriminadora).

## Workflow

```bash
# depois de `docker compose up -d` e configurar .env (ver README)
pnpm db:generate       # gera o Prisma Client em packages/database/src/generated
pnpm db:migrate        # cria/aplica migration em dev (pede um nome na 1ª vez)
pnpm db:seed           # popula permissões, org "MilWeb", papéis, pipeline padrão, usuário owner
pnpm db:studio         # Prisma Studio (GUI) — alternativa ao Adminer do docker-compose
```

Em produção: `pnpm db:migrate:deploy` (aplica migrations existentes, não
gera novas — nunca rodar `migrate dev` fora do ambiente local).

O seed cria o usuário `rick@milweb.com.br` com senha definida por
`SEED_OWNER_PASSWORD` (ou `millead-dev-only` se a env var não estiver
setada — **trocar antes de rodar contra qualquer banco que não seja
local**).
