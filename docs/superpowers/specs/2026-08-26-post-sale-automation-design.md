# Automação pós-fechamento — design

> Contrato assinado → lead ganho → recebimentos → briefing → projeto →
> tarefas → tudo registrado na timeline.
>
> Primeira etapa da transformação dos módulos isolados do MilLead num fluxo
> operacional único (Lead → Auditoria → Orçamento → Proposta → Contrato →
> Recebimento → Briefing → Projeto → Entrega → Pós-venda).

## O problema

Antes desta fase, o MilLead ia sozinho até a assinatura e parava ali:

| Etapa | Antes |
| --- | --- |
| Orçamento → Proposta | automático (`EstimateService`) |
| Proposta aceita (`/p/:token`) → Contrato RASCUNHO | automático, idempotente por `proposalId` unique |
| Contrato → PDF → documento de assinatura | automático (fila `contract-process`) |
| Webhook de assinatura → `ASSINADO` | automático (`ContractService.handleSignatureWebhook`) |
| **Lead marcado como ganho** | **manual** — `moveStage` só era chamado pela UI |
| **Plano de recebimento** | **manual** — `createPlan` só era chamado pelo `plan-dialog.tsx` |
| **Briefing** | **manual**, e sem vínculo com o contrato |
| **Projeto** | **manual**, e sem vínculo com lead nem contrato |
| **Tarefas do pós-venda** | **inexistentes** |

O contrato mais importante do funil — o que acabou de ser assinado — era
justamente o que exigia mais trabalho manual, feito de memória, logo depois
de uma venda.

## Duas regras que governam o desenho inteiro

**1. A assinatura é fato consumado.** A automação só é acionada DEPOIS de o
contrato estar persistido como `ASSINADO`, e nada nela pode desfazer, atrasar
ou esconder isso. Concretamente:

- `PostSaleOnboardingService.trigger()` é chamado após `markSigned`, e engole
  qualquer erro (vira `ContractEvent AUTOMACAO_FALHA_DISPARO`).
- O `ContractService` ainda envolve a chamada num `try/catch` externo,
  redundante de propósito: um 500 no webhook faria o provedor reenviar, e o
  reenvio sai cedo no `status === "ASSINADO"` — o cliente **nunca** receberia
  a notificação de contrato assinado por causa de uma falha de automação.
- Cada etapa é isolada: uma que explode vira `FAILED` e as seguintes rodam.

**2. Nada é adivinhado.** Faltando configuração obrigatória, a etapa não
escolhe um valor plausível: registra `NEEDS_ACTION` e cria uma tarefa pra uma
pessoa decidir. Por isso `installmentCount`, `entryDueDays` e
`firstInstallmentDueDays` são **anuláveis sem default no banco** — dar a eles
um default seria o sistema arbitrando o plano financeiro do cliente.

## Fluxo

```
                       webhook do provedor de assinatura
                                     │
                    ContractService.handleSignatureWebhook
                                     │
                    (verifica HMAC → reconsulta o provedor)
                                     │
                              markSigned  ◄── ponto sem volta: a assinatura
                                     │         está gravada daqui em diante
                    ContractEvent "ASSINADO"
                                     │
                  PostSaleOnboardingService.trigger()   (best-effort duplo)
                                     │
                   settings.enabled ? segue : para aqui
                                     │
             AutomationExecution PENDING (upsert idempotente)
                                     │
                 fila pg-boss "post-sale-onboarding"
                                     │
        ══════════════════ worker (processo separado) ══════════════════
                                     │
                  claimExecution (CAS PENDING|PARTIAL|FAILED → RUNNING)
                                     │
      ┌──────────┬──────────────┬───────────┬──────────┬─────────────┐
   LEAD_WON   RECEIVABLES     BRIEFING    PROJECT      TASKS
      │            │              │           │           │
   moveStage   createPlan     BriefingService ProjectChecklist  TaskService
   (Activity)  (entrada +     .create        Service.create   ×5 (idempotentes)
               parcelas)      (+ link        (16 fases,
                              público,        prazo do
                              push interno)   contrato)
      └──────────┴──────────────┴───────────┴──────────┴─────────────┘
                                     │
                     resolveExecutionStatus(etapas)
                                     │
              SUCCEEDED / PARTIAL / FAILED + ContractEvent + push
```

## Configuração (`PostSaleAutomationSettings`, uma por organização)

Decisão: **modelo próprio**, não extensão de `FinanceSettings` nem de
`Organization`. Motivo: `FinanceSettings` é sobre precificação (câmbio, hora,
margem) e é lido por outro módulo; misturar prazos de automação lá acoplaria
dois domínios que mudam por razões diferentes. `Organization` é identidade,
não configuração operacional.

| Campo | Default | O que faz quando ausente |
| --- | --- | --- |
| `enabled` | `false` | Nada acontece — nenhuma execução é criada |
| `wonStageId` | `null` | `LEAD_WON` vira pendência + tarefa |
| `briefingTemplateKey` | `null` | `BRIEFING` vira pendência + tarefa |
| `projectType` | `null` | `PROJECT` vira pendência + tarefa |
| `defaultOwnerId` | `null` | Tarefas caem no `createdById` do contrato |
| `createReceivables` | `true` | — |
| `installmentCount` | `null` (**sem default**) | `RECEIVABLES` vira pendência |
| `entryDueDays` | `null` (**sem default**) | `RECEIVABLES` vira pendência |
| `firstInstallmentDueDays` | `null` (**sem default**) | `RECEIVABLES` vira pendência |
| `createBriefing` | `true` | — |
| `createProject` | `true` | — |

`enabled` nasce `false`: a migration não muda o comportamento de nenhuma
organização existente. Ligar a automação é uma decisão explícita.

**Validação de tenant na gravação.** `wonStageId`, `briefingTemplateKey` e
`defaultOwnerId` são checados contra a organização do contexto autenticado
antes de persistir. A FK sozinha não garante isso — ela só exige que a linha
exista *em algum lugar*. Além disso:
- o estágio precisa ter `isWon = true` (senão `moveStage` deixaria o lead
  `OPEN` e a automação "marcaria como ganho" sem marcar nada);
- o template não pode ser `CUSTOM` (vale pra um envio só, por construção).

**Permissão:** `settings:manage` para ler **e** escrever.

## Idempotência

O webhook pode ser reenviado N vezes. Três travas de banco, uma por pergunta:

| Tabela | Unique | Pergunta que responde |
| --- | --- | --- |
| `automation_executions` | `(organizationId, eventType, contractId)` | "este contrato já disparou a automação?" |
| `automation_steps` | `(executionId, key)` | "esta etapa já rodou nesta execução?" |
| `automation_artifacts` | `(executionId, key)` | "este artefato já foi criado?" |

Mais duas travas de reforço no destino:
- `project_checklists.contract_id` é **UNIQUE** (Postgres aceita N nulos num
  unique de coluna anulável) — projeto duplicado por contrato é impossível no
  banco, não só na aplicação;
- `briefings.contract_id` **não** é unique de propósito: um contrato pode
  legitimamente render mais de um briefing (duplicar, reenviar). A trava
  contra duplicata *da automação* é o artefato.

E o compare-and-swap: `claimExecution` faz
`UPDATE ... WHERE id = ? AND status IN ('PENDING','PARTIAL','FAILED')`.
Duas chamadas concorrentes (webhook reenviado + reprocessamento manual)
disputam a linha e só uma sai com `count > 0`. `SUCCEEDED` está fora da lista:
automação concluída nunca roda de novo.

Por que não um `result Json` no step em vez da tabela de artefatos? Porque
JSON não dá trava de banco nenhuma — e é exatamente a trava que o reenvio de
webhook exige. A tabela também é de onde a tela tira os links pro que foi
criado.

## Estados

**Execução:** `PENDING → RUNNING → SUCCEEDED | PARTIAL | FAILED`

**Etapa:** `PENDING → RUNNING → SUCCEEDED | SKIPPED | NEEDS_ACTION | FAILED`

- `SKIPPED` = desligada na configuração, ou não aplicável (contrato sem lead).
  **Não conta como pendência** — desligar briefing não pode fazer a automação
  parecer "parcial".
- `NEEDS_ACTION` = faltou configuração; a etapa criou uma tarefa acionável.

Regra de agregação (`resolveExecutionStatus`, função pura):

```
relevantes = etapas onde status ≠ SKIPPED
relevantes vazio            → SUCCEEDED   (tudo desligado de propósito)
todas SUCCEEDED             → SUCCEEDED
todas FAILED                → FAILED
caso contrário              → PARTIAL
```

## Reprocessamento

`POST /api/v1/contracts/:id/post-sale/reprocess` (`proposals:write`).

- Roda **só o que não está `SUCCEEDED`**. Etapas `SKIPPED` **são** reavaliadas:
  se o dono ligou "criar briefing" depois da primeira execução, o reprocesso
  passa a criar. Etapa `SUCCEEDED` nunca é reavaliada — é o que garante não
  duplicar.
- É também o caminho **retroativo**: contrato assinado antes de a automação
  ser ligada não tem execução nenhuma até alguém clicar. Nesse caso o
  endpoint cria a execução e enfileira.
- Recusa (422) contrato que não está `ASSINADO` e execução já `SUCCEEDED`.

## Tratamento de falhas

| Falha | Consequência |
| --- | --- |
| `enqueue` falha (fila fora) | Execução fica `PENDING`, evento `AUTOMACAO_FALHA_DISPARO`, botão "Reprocessar" resolve |
| Uma etapa lança | Etapa `FAILED` com a mensagem; as seguintes rodam; execução `PARTIAL` |
| Todas as etapas relevantes falham | Execução `FAILED` |
| Contrato não está mais `ASSINADO` | Execução `FAILED` com motivo, sem tocar em nada |
| Estágio de ganho apagado depois de configurado | `NEEDS_ACTION` + tarefa, lead **não** é movido |
| Plano de recebimento já existe (com ou sem parcela paga) | Etapa `SUCCEEDED`, plano intacto — nunca recria |

Nada gravado em `error` carrega stack, token, PDF ou snapshot do contratante.
`AutomationExecution.payload` guarda só `numero`, `valorTotal`, `tipo` e
`assinadoEm`.

## Notificações e timeline

| Evento | Onde é registrado |
| --- | --- |
| Contrato assinado | `ContractEvent ASSINADO` (já existia) |
| Automação enfileirada / iniciada | `ContractEvent AUTOMACAO_ENFILEIRADA` / `AUTOMACAO_INICIADA` |
| Lead marcado como ganho | `Activity STATUS_CHANGE` (via `LeadService.moveStage`) |
| Recebimentos criados | `Activity OTHER` (`kind: post_sale_receivables_created`) |
| Briefing criado | `Activity BRIEFING_SENT` (via `BriefingService`) + push interno |
| Projeto criado | `Activity OTHER` (`kind: post_sale_project_created`) |
| Tarefas criadas | `Activity TASK_CREATED` |
| Automação concluída / parcial / falhou | `ContractEvent` + push (**só quando o desfecho MUDA**) |
| Automação reprocessada | `ContractEvent AUTOMACAO_REPROCESSADA` |
| Alteração da configuração | `AuditLog settings.update` (middleware `audit-mutations`, automático) |

O push de desfecho só sai quando o status muda: reprocessar uma execução que
continua `PARTIAL` não notifica de novo.

Nenhuma mensagem é enviada ao cliente. O briefing nasce com link público
pronto; quem envia é uma pessoa, pelo canal que escolher.

## Decisões de schema

**Menor alteração coerente**, campo a campo:

| Campo | Decisão | Motivo |
| --- | --- | --- |
| `briefings.contract_id` | **adicionado** (nullable, index) | Sem ele não há como saber se um contrato já tem briefing sem varrer artefatos de execuções |
| `project_checklists.contract_id` | **adicionado** (nullable, **unique**) | Trava de banco contra projeto duplicado por contrato |
| `project_checklists.lead_id` | **adicionado** (nullable, index) | Requisito explícito: o projeto tem que ficar ligado ao lead |
| `project_checklists.started_at` / `due_at` | **adicionados** (nullable) | Vêm de dado confiável do contrato (`assinadoEm` + `prazoEntregaDias`); sem eles não há prazo estimado |
| `tasks.contract_id` | **NÃO adicionado** | `tasks` é tabela quente usada por todo o CRM. A referência ao contrato vai na descrição (com link) e o vínculo forte vive em `automation_artifacts`, que já é a fonte de idempotência. Adicionar coluna aqui seria uma segunda fonte de verdade pro mesmo fato |
| `automationKey` em tabelas de destino | **NÃO adicionado** | Seria espalhar a chave de idempotência por 4 tabelas. `automation_artifacts` concentra isso numa só |
| `ownerId` em `ProjectChecklist` | **NÃO adicionado** | `defaultOwnerId` vive na configuração e chega nas tarefas (que têm `assigneeId`). Projeto ainda não tem tela de responsável — coluna sem consumidor |

Todas as tabelas novas carregam `organizationId` e têm RLS habilitado tanto
na migration quanto pelo `ensure-rls.sql` (que não precisou mudar — ele é
genérico sobre o schema `public`).

## Fila

Reusa **pg-boss** (fila no próprio Postgres), que substituiu BullMQ+Redis em
21/07/2026. Fila nova: `post-sale-onboarding`, `retryLimit: 2` (3 tentativas),
`singletonKey: executionId`.

O `singletonKey` é a *primeira* camada anti-duplicata, não a garantia: enquanto
um job da execução está na fila ou rodando, o pg-boss descarta duplicatas. A
garantia real é o CAS + os uniques. O retry é seguro porque `run` reexecuta só
o que não concluiu.

## API

| Método | Rota | Permissão |
| --- | --- | --- |
| `GET` | `/api/v1/settings/post-sale-automation` | `settings:manage` |
| `PATCH` | `/api/v1/settings/post-sale-automation` | `settings:manage` |
| `GET` | `/api/v1/settings/members` | `settings:manage` |
| `GET` | `/api/v1/contracts/:id/post-sale` | `proposals:read` |
| `POST` | `/api/v1/contracts/:id/post-sale/reprocess` | `proposals:write` |

`GET /contracts/:id/post-sale` responde **200 com `execution: null`** quando o
contrato nunca disparou a automação — não é 404: o contrato existe, só não tem
execução. A tela usa isso pra mostrar "nenhuma automação" em vez de erro.

`GET /settings/members` é uma adição mínima e somente-leitura (id, nome,
e-mail, papel) — necessária pro seletor de responsável padrão. **Não** é o
módulo de gestão de equipe, que continua não existindo.

No `PATCH`, `null` explícito limpa o campo e ausente não mexe — sem isso não
haveria como desconfigurar um estágio ou template já salvo.

## Frontend

- **`/settings/automation`** — formulário completo, com aviso do que ainda
  falta configurar (campo `missing` da API) e estados de loading/erro/vazio.
  Sem `settings:manage`, mostra `EmptyState` de permissão.
- **Detalhe do contrato** — card "Pós-fechamento" com status, as 5 etapas
  (ícone + detalhe + erro), links pro que foi criado e botão de reprocessar.
  Só aparece em contrato `ASSINADO`. Faz polling enquanto `PENDING`/`RUNNING`
  e para nos estados terminais (mesmo raciocínio do polling de contrato: uma
  automação que falhou não muda sozinha, e refetch eterno faz a tela "girar
  pra sempre").
- O botão de reprocessar some em `RUNNING`/`SUCCEEDED` — os dois casos que a
  API recusaria.

## Testes

`apps/api`: 59 testes novos (406 → 465).

- `post-sale-onboarding-service.test.ts` (34) — os 17 cenários pedidos, mais
  arredondamento de centavos, entrada de 100%, plano com parcela paga e
  deduplicação de notificação.
- `post-sale-settings-service.test.ts` (14) — validação de tenant, estágio que
  não é de ganho, template CUSTOM, `missingConfig`.
- `post-sale-routes.test.ts` (8) — RBAC de verdade: Express numa porta
  efêmera + `fetch`, provando que sem `settings:manage` dá 403 e o controller
  nem é chamado.
- `contract-signature-webhook.test.ts` (4) — regressão do fluxo de assinatura.

O fake do repositório (`post-sale-fakes.ts`) **reproduz as três travas de
unicidade e o CAS**, em vez de ser um `vi.fn()` que aceita tudo. Um mock
permissivo passaria nos testes de idempotência e mentiria.

`apps/web`: 6 testes novos (168 → 174) nos helpers puros de rótulo/rota.

## Como testar à mão

1. `pnpm db:migrate:deploy` e `pnpm db:generate`.
2. Em `/settings/pipeline`, garanta um estágio com "ganho" marcado.
3. Em `/settings/automation`: ligue a automação, escolha o estágio de ganho,
   o responsável, o template `institucional-v1`, o tipo de projeto, e
   preencha 2 parcelas / 3 dias / 30 dias. Salve.
4. Suba a API com `START_WORKERS=true` (ou rode `pnpm --filter @millead/api dev:worker`
   em paralelo) — **sem o worker nada sai da fila**.
5. Crie um contrato com `SIGNATURE_PROVIDER=mock` e leve até
   `AGUARDANDO_ASSINATURA`.
6. Simule a assinatura:
   `POST http://localhost:4000/api/v1/webhooks/signature`
   com `{"evento":"ASSINADO","docId":"<signatureDocId do contrato>"}`.
7. Abra o contrato: o card "Pós-fechamento" deve mostrar as 5 etapas
   concluídas e os links pro lead, briefing, projeto e tarefas.
8. **Repita o passo 6 mais duas vezes** e recarregue: nada duplicado, mesma
   execução, mesmas tarefas.
9. Para testar pendência: limpe o template de briefing na configuração, crie
   outro contrato, assine. A etapa Briefing deve ficar "Precisa de ação" com a
   tarefa "Selecionar e enviar briefing" em `/tasks`. Configure o template e
   clique "Reprocessar" — só o briefing é criado.

## Não faz parte desta fase

Envio automático de mensagem ao cliente, central "Hoje", follow-ups/cadências,
forecast, importação de leads, integrações de WhatsApp/e-mail/calendário,
evolução do módulo Projetos, portal do cliente e pós-venda propriamente dito.
Ver o roadmap no plano.
