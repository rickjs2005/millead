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

  | Tabela                  | Unique                                    | Pergunta                       |
  | ----------------------- | ----------------------------------------- | ------------------------------ |
  | `automation_executions` | `(organizationId, eventType, contractId)` | "este contrato já disparou?"   |
  | `automation_steps`      | `(executionId, key)`                      | "esta etapa já rodou?"         |
  | `automation_artifacts`  | `(executionId, key)`                      | "este artefato já foi criado?" |

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

### 6. Cofre Financeiro (financas pessoais do dono)

`PersonalVault` · `PersonalAccount` · `PersonalCreditCard` ·
`PersonalCategory` · `PersonalMerchant` · `PersonalMerchantAlias` ·
`PersonalTransaction` · `PersonalTransactionSplit` · `PersonalStatement` ·
`PersonalImportBatch` · `PersonalImportProfile` ·
`PersonalClassificationRule` ·
`PersonalSubscription` · `PersonalSubscriptionAlert`

**Unica tabela do schema SEM `organizationId`, de proposito.** O dono e o
usuario (`ownerUserId`, com `@unique`), nao a organizacao. A coluna
significaria "este dado pertence a organizacao", e e exatamente disso que o
Cofre precisa nao participar: com ela, qualquer repositorio que filtrasse por
tenant -- o padrao da casa -- devolveria dado financeiro pessoal a quem tem
papel na empresa.

Pela mesma razao o modulo **nao usa RBAC**: `ADMIN_PERMISSIONS` e
`ALL_PERMISSIONS` menos billing, entao uma chave `vault:*` nova entraria
sozinha no papel Admin de toda organizacao. A autorizacao e posse + sessao
elevada. Detalhes em [personal-finance-vault.md](./personal-finance-vault.md).

Campos que carregam decisao:

- `failed_attempts` / `locked_until` -- lockout escalonado **persistido**. Em
  memoria zeraria a cada cold start do Render free, devolvendo tentativas de
  graca a quem esta atacando.
- `sessions_invalidated_at` -- corte de sessoes elevadas. Todo token com `iat`
  anterior morre na hora; e o que faz "Bloquear agora", o logout e a troca de
  senha serem revogacao de verdade, e nao so limpeza de cookie.

As tabelas do nucleo penduram em `vaultId` (e nao em `ownerUserId`): os dois
provariam a mesma coisa, mas `req.vault` so existe DEPOIS que `requireVault`
confirmou a posse -- filtrar pelo `vaultId` e filtrar exatamente pelo que foi
autorizado, sem uma segunda coluna que alguem possa esquecer de checar.

Decisoes de modelagem do nucleo (fase 2):

- **Sem booleano de rateio na movimentacao.** `isBusiness`/`isReimbursable`
  NAO existem como coluna: quem manda e `PersonalTransactionSplit`, e os
  indicadores sao derivados na leitura. Dois lugares dizendo a mesma coisa e
  como nasce contagem dupla.
- **Valor sempre positivo + `direction` explicita.** Sinal negativo e ambiguo
  entre bancos e vira erro silencioso de soma.
- **`fingerprint` com um unique so** (`vaultId, fingerprint`) cobrindo duas
  estrategias: derivado do FITID quando existe, calculado quando nao. Nulo em
  lancamento manual -- dois cafes de R$5 no mesmo dia sao duas despesas reais.
- **Seis CHECKs** que o Prisma nao expressa: origem unica (conta XOR cartao),
  valor positivo, parcela coerente, divisao positiva, dias de cartao validos e
  fatura sem pagamento negativo. Sao regras de dinheiro -- deixa-las so na
  aplicacao significa gravar numero errado em silencio.
- **FKs `Restrict`** em conta e cartao: apagar cadastro nao pode levar o
  historico financeiro junto. A API responde 409 pedindo pra desativar.

Importacao (fase 3):

- **O arquivo bancario NAO e persistido.** `personal_import_batches` guarda
  hash, nome higienizado, periodo, formato, contagens e erros por numero de
  linha -- nada que reconstrua o extrato. Extrato e o documento mais sensivel
  do Cofre, e um arquivo guardado "por precaucao" e um arquivo que pode vazar.
- **`errors` e `[{ line, code }]`**, nunca a descricao bancaria. Ha teste que
  falha se conteudo do extrato aparecer no erro.
- **`personal_transactions.import_batch_id`** e a procedencia da linha
  (SetNull: apagar o registro do lote nao leva as movimentacoes junto).
- **`personal_import_profiles`** guarda o mapeamento de colunas por
  banco/cartao: CSV de banco nao tem padrao, e remapear toda vez e o atrito
  que faz a pessoa parar de importar.
- A idempotencia da importacao vem do `createMany({ skipDuplicates: true })`
  sobre o unique `(vault_id, fingerprint)` -- e o banco, nao a checagem da
  pre-visualizacao, que impede a linha repetida de entrar.
- **A importacao escreve em `personal_contacts` e `personal_merchants`.** O
  extrato traz o nome e o documento da contraparte, e CPF/CNPJ dizem qual das
  duas tabelas recebe. **Nao ha unique de nome em nenhuma das duas, de
  proposito**: nome nao e identidade, homonimo e legitimo, e uma constraint
  transformaria isso em erro 500 no meio de uma importacao. A unicidade e
  garantida no servico, comparando o nome normalizado -- a mesma normalizacao
  do fingerprint.
- **Desfazer apaga as duas pontas no servico, nao no banco.** A FK continua
  `SetNull` (apagar o lote sozinho nao pode levar historico junto); quem
  apaga movimentacoes e lote na mesma transacao e o `undoImport`, depois de
  conferir que nenhuma linha baixa divida ou virou despesa da MilWeb -- essas
  sao `Restrict` e o Postgres recusaria com um 500.

Classificacao (fase 4):

- `personal_classification_rules` tem condicoes (contem/comeca/exato,
  fornecedor, conta, cartao, faixa de valor) combinadas com E, e acoes
  (fornecedor, categoria, percentual empresarial). `priority` menor roda
  primeiro, com desempate por id -- sem ordem total, a mesma movimentacao
  cairia em categorias diferentes entre execucoes.
- Tres CHECKs: percentual em 0..100, faixa de valor coerente e
  `match_type`/`match_value` sempre juntos.
- `match_value` e gravado JA NORMALIZADO, igual a descricao da movimentacao --
  normalizar na escrita e o que faz a comparacao ser igualdade simples.
- A ligacao com assinatura entra na fase 5 como coluna aditiva.

Assinaturas e alertas (fase 5):

- `personal_subscription_alerts.dedupe_key` com unique `(vault_id, dedupe_key)`
  e' o que torna a verificacao a cada abertura do app idempotente. Um unique
  com `subscription_id` anulavel NAO resolveria: o Postgres aceita N nulos, e
  os alertas sem assinatura se multiplicariam.
- `personal_subscriptions.cost_subscription_id` aponta pra assinatura
  EMPRESARIAL **sem FK**, de proposito: `cost_subscriptions` pertence a
  organizacao e a assinatura pessoal pertence ao Cofre -- uma FK entre os dois
  mundos daria ao banco um caminho de leitura que a aplicacao existe pra
  impedir. O elo e resolvido na fase 7, com posse verificada dos dois lados.
- Cinco CHECKs: intervalo so em CUSTOM (e CUSTOM sempre com intervalo),
  intervalo plausivel, valor positivo, tolerancia e antecedencia em faixa.
- Colunas aditivas: `personal_transactions.subscription_id` (qual assinatura a
  cobranca paga) e `personal_classification_rules.set_subscription_id` (a
  coluna prometida na fase 4).

As tabelas de dividas (`personal_contacts`, `personal_debts`,
`personal_debt_payments`) seguem a mesma regra: dono pelo Cofre, RLS ligada,
nenhum dado sensivel de terceiro (sem CPF, conta ou chave Pix). Tres decisoes
de modelagem que valem registro:

- **Nao existe coluna de valor pago, saldo nem status de divida.** Os tres sao
  derivados das baixas e da data de hoje. Uma divida vira ATRASADA pela
  passagem do tempo, sem ninguem escrever nada -- uma coluna gravada estaria
  errada toda madrugada. So `canceled_at` e coluna, porque so o cancelamento e
  um evento.
- **`personal_debt_payments.transaction_id` e UNIQUE.** Uma movimentacao baixa
  no maximo uma divida; sem isso a mesma entrada de R$200 poderia baixar duas
  dividas de R$200 e o banco teria inventado dinheiro. E o vinculo que sustenta
  a regra "Pix de quitacao nao e renda".
- **A soma das baixas x valor da divida NAO tem CHECK.** E a unica invariante
  de dinheiro do Cofre que o Postgres nao consegue defender sozinho: ela
  relaciona linhas de tabelas diferentes, e CHECK so enxerga a propria linha. O
  gatilho que resolveria seria regra de negocio escondida no banco, longe dos
  testes -- entao ela vive em `validatePayment`, no servico.

### 7. Billing

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

> ## ⚠️ `--shadow-database-url` APAGA o banco que você apontar
>
> `prisma migrate diff --shadow-database-url <URL>` e `prisma migrate dev`
> **resetam** o banco daquela URL (dropam e recriam o schema `public`) pra
> replayar as migrations e calcular o estado "from". O nome do flag e o verbo
> "diff" sugerem leitura; **não é**.
>
> Isso já custou caro: em 26/08/2026 esse comando foi rodado com a
> `DATABASE_URL` de produção como shadow, e apagou todos os dados do banco
> do Supabase (o schema `public` inteiro; `pgboss`, fora dele, sobreviveu).
> Free tier **não tem backup automático** — a recuperação foi re-seed, e o
> que era dado de negócio se perdeu.
>
> **Regra:** nenhum comando do Prisma recebe a `DATABASE_URL` de produção
> como `--shadow-database-url`. Pra gerar o SQL de uma migration nova, use um
> banco descartável (Postgres local/Docker, ou um projeto Supabase de
> rascunho) — ou `prisma migrate dev` apontado pra esse banco descartável.
>
> Se o histórico do Prisma (`_prisma_migrations`) sumir mas o schema estiver
> correto, o conserto é baseline, não re-aplicar:
> `prisma migrate resolve --applied <nome>` para cada migration, em ordem.

O seed cria o usuário `rick@milweb.com.br` com senha definida por
`SEED_OWNER_PASSWORD` (ou `millead-dev-only` se a env var não estiver
setada — **trocar antes de rodar contra qualquer banco que não seja
local**).

### 7. Ponte entre o Cofre e o financeiro (fase 7)

Duas tabelas ligam os dois mundos sem que nenhum enxergue o outro por inteiro:

- **`business_expenses`** e o REALIZADO da empresa (o que de fato saiu, com
  data). Vive no mundo multi-tenant, com `organization_id`. Nao confundir com
  `cost_subscriptions`, que e o PLANEJADO, nem com `cost_usage_entries`, que
  mede consumo de credito dentro de um plano ja contratado -- reusar aquela
  tabela obrigaria toda despesa a pendurar numa assinatura e a virar uma
  quantidade de creditos.
- **`personal_business_allocations`** e o elo. E a UNICA tabela que sabe os dois
  lados, e por isso e a unica que o financeiro nao le.

Tres decisoes que valem registro:

- **`business_expenses` nao tem coluna nenhuma apontando pro Cofre.** Quem tem
  permissao no financeiro ve valor, data e a descricao que o dono escreveu --
  e nao chega na movimentacao pessoal, na conta, no cartao nem nas outras
  divisoes daquela compra.
- **`personal_business_allocations.transaction_id` e UNIQUE.** E a chave de
  idempotencia da ponte: uma compra gera no maximo uma despesa. A chave e a
  movimentacao, e nao a divisao, porque as divisoes sao substituidas em bloco
  -- corrigir o rateio troca o id da divisao, e a mesma compra seria enviada de
  novo, dobrando o custo da empresa.
- **A FK pro Cofre e Restrict; a FK pra despesa e Cascade.** Apagar a compra com
  envio ativo deixaria uma despesa empresarial sem lastro (o servico recusa
  antes, com 409). Apagar a despesa pelo financeiro, ao contrario, desfaz o
  envio: o elo cai junto e o Cofre volta a mostrar "nao enviada", que e a
  verdade.

Nao existe FK entre `personal_subscriptions.cost_subscription_id` (ou
`business_expenses.cost_subscription_id` visto do Cofre) e o mundo
multi-tenant, de proposito -- uma chave estrangeira ali obrigaria o banco a
conhecer os dois donos ao mesmo tempo. O preco e que a verificacao de posse vira
responsabilidade de quem grava, e ela existe: `CostSubscriptionVerifier`.
