# MilLead (CRM interno MilWeb)

Tipo: sistema
Stack: Next.js 15 + React 19 + TypeScript, Express, PostgreSQL (Prisma), pg-boss (fila no proprio Postgres), pnpm + Turborepo, Clean Architecture multi-tenant

## Progresso

Fase 01 — Descoberta e arquitetura ✓ (Clean Architecture documentada, roadmap de 8 fases concluído segundo o README)
Fase 02 — UX/UI ✓ (frontend cobre todos os módulos, dashboard funcional)
Fase 03 — Modelagem do banco ✓ (migrations em packages/database/prisma, multi-tenant via `organizationId`)
Fase 04 — Backend ✓ (domain/application/infrastructure/interfaces, health checks, rate-limit middleware)
Fase 05 — Autenticação e autorização ✓ (27/08 verificado: `requirePermission` em todas as rotas de negócio, permissões resolvidas do banco a cada request, e a gestão de equipe fechou o ciclo — papéis custom, membro suspenso e bloqueio de escalada de privilégio)
Fase 06 — Frontend ✓ (todos os módulos consomem `apps/web/src/services`)
Fase 07 — Integrações ◐ (ZapSign/contratos, IA Claude, Instagram/MilSocial existem; memória registra pendência antiga de bug de e-mail na Autentique/ZapSign — não reverificado)
Fase 08 — Segurança ◐ (JWT + rate-limit presentes; memória cita achados de segurança "baixos" pendentes em millead-pendencias-seguranca.md — não reverificados)
Fase 09 — Testes ◐ (27/08: 477 API + 182 web + 56 runner + 21 video-contracts = 736, todos passando. DOIS gaps confirmados: (a) o CI **não roda testes** — ci.yml só faz format/lint/type-check/build; (b) nenhum E2E dos fluxos públicos (/b/:token, /p/:token, /fechamento/:slug))
Fase 10 — Performance ○ (não verificado nesta sessão)
Fase 11 — Observabilidade ◐ (27/08 reverificado: health checks + pino existem; **zero** error tracking — nenhum Sentry/equivalente em nenhum package.json. Erro em produção só aparece se alguém abrir o log do Render)
Fase 12 — Infraestrutura ✓ (Render blueprint p/ API, Vercel p/ web, Supabase, Upstash, CI em .github/workflows/ci.yml)
Fase 13 — QA final ○ (não rodado nesta sessão)
Fase 14 — Deploy ✓ (millead.milweb.com.br + millead-api.onrender.com no ar, conforme memória e render.yaml)
Fase 15 — SEO para páginas públicas ◐ (27/08 checado: **não é N/A**. Não existe robots.txt nem robots.ts, e não há `noindex` em lugar nenhum — mas existem 3 rotas públicas sem login com dado de cliente: /b/:token (briefing), /p/:token (proposta com valor) e /fechamento/:slug. Aqui o objetivo é o INVERSO de SEO: impedir indexação)
Fase 16 — Pós-lançamento ◐ (keep-api-awake.yml mitiga cold start do free tier; milsocial-sync.yml roda diário; sem monitoramento de erro/uptime de terceiros identificado)

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

## Trabalho de 27/08/2026 — Cofre Financeiro, Fase 2 (nucleo)

Commit na mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**.
Oito tabelas novas (contas, cartoes, categorias, fornecedores, aliases,
movimentacoes, divisoes, faturas), penduradas em `vaultId`, todas as rotas
atras de `requireVault`, nenhuma com RBAC.

Decisoes que valem lembrar:

- **`isBusiness`/`isReimbursable` NAO viraram coluna.** O rateio mora so nas
  divisoes e os indicadores sao derivados na leitura. Foi um desvio consciente
  da lista de campos do pedido do Rick -- a API continua expondo os
  indicadores, so nao os persiste. Motivo: dois lugares dizendo a mesma coisa
  e como nasce contagem dupla, que e o risco numero um do modulo.
- **Pagamento de fatura nasce como transferencia** e nao e vinculado a fatura
  que quita (senao somaria ao total que paga). Coberto por teste.
- **Seis CHECKs no banco** (origem unica conta XOR cartao, valor positivo,
  parcela coerente, divisao positiva, dias de cartao validos, fatura sem
  pagamento negativo) -- o Prisma nao expressa nenhum deles.
- **Dinheiro em centavos inteiros** (`vault-money.ts`) e **datas em UTC**
  (`vault-date.ts`), com teste especifico pro deslize de dia por fuso.
- `fingerprint` com um unique so cobrindo FITID e calculo; nulo em lancamento
  manual pra dois cafes iguais no mesmo dia nao colidirem.

Migration `20260827160000_add_personal_vault_core` **aplicada em producao**
(aditiva; verificado: 9 tabelas do Cofre com RLS, 6 CHECKs presentes, dados
preservados). 124 testes novos -> **642 na API** (777 no monorepo).
type-check, lint e build limpos.

**Ainda nao ha tela pro nucleo** -- as telas sao a fase 8 do plano acordado.
Hoje o nucleo so e acessivel pela API.

## Trabalho de 27/08/2026 — Cofre Financeiro, Fase 3 (importacao)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**.
Importacao de OFX e CSV em dois passos (pre-visualizar / confirmar), com
deduplicacao, mapeamento de colunas e modelos por banco.

Decisao que define o desenho: **o arquivo bancario nao e persistido em lugar
nenhum** -- nem storage, nem tabela de rascunho entre os passos. Chega como
texto no corpo JSON, vive na memoria da requisicao e acaba ali. O lote guarda
so hash, nome higienizado, periodo, contagens e erros por numero de linha.

Consequencia assumida: a pre-visualizacao devolve as linhas e a confirmacao
manda de volta as escolhidas, entao **o servidor nao confia no que volta** --
fingerprint recalculado, duplicatas reconferidas contra o banco, origem
revalidada. O cliente escolhe QUAIS linhas entram, nao o que elas sao.

Outros pontos:

- **Parsers proprios**, sem dependencia nova: OFX 1.x (SGML, tags que nao
  fecham -- o formato mais comum nos bancos daqui, e o que um parser XML
  quebraria) e 2.x (XML); CSV com aspas, CRLF e BOM.
- **Separador de coluna escolhido por consistencia**, nao por contagem: num
  extrato brasileiro a virgula decimal aparece em toda linha e ganharia a
  contagem, quebrando tudo.
- **Mapeamento conferido contra o cabecalho** antes de ler linha nenhuma. E o
  que separa "isso nao e um extrato" (HTML de sessao expirada) de "mapeei a
  coluna errada" -- e deixa "mes sem movimentacao" como resultado vazio
  legitimo, nao erro.
- **Idempotencia no banco**: `createMany({ skipDuplicates: true })` sobre o
  unique `(vault_id, fingerprint)`. A checagem da pre-visualizacao e pra VER;
  o unique e o que impede.
- **Erros de linha sao codigos** (`VALOR_INVALIDO`), nunca conteudo do
  extrato, com teste que falha se a descricao bancaria vazar pro log.
- Linhas importadas nascem `PENDING` -- quem confirma a classificacao e a
  fase 4.

Achado corrigido no caminho: `importBatchId` estava sendo gravado sem existir
no tipo de dominio (passava pelo Prisma e funcionava, mas o TypeScript nao
modelava o campo). Declarado em `PersonalTransaction` e `CreateTransactionInput`.

Migration `20260827190000_add_personal_vault_import` **aplicada em producao**
(aditiva: 2 tabelas, 2 enums, 1 coluna anulavel; RLS e 2 CHECKs verificados).
87 testes novos -> **729 na API** (988 no monorepo). type-check, lint e build
limpos.

**Ainda nao ha tela** pro nucleo nem pra importacao -- telas sao a fase 8.

## Trabalho de 27/08/2026 — Cofre Financeiro, Fase 4 (classificacao)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**. Cascata
deterministica de 5 niveis + regras do usuario, **sem IA nenhuma** (decisao
explicita do pedido: palpite errado em classificacao nao gera erro, gera numero
plausivel).

Decisoes que valem lembrar:

- **Preenchimento de lacunas, nao "o primeiro nivel decide tudo".** Cada nivel
  preenche so o que os anteriores deixaram vazio. Sem isso, uma regra do tipo
  "tudo neste cartao e 100% empresarial" bloquearia o alias e deixaria a
  movimentacao sem categoria -- a regra tornaria o resultado PIOR do que se
  nao existisse.
- **Recorrencia nao e voto de maioria.** Descricao que ja foi pra duas
  categorias diferentes volta pra revisao; escolher a mais frequente
  classificaria errado com ar de certeza.
- **Ordem de regras e explicita** (`priority`, desempate por id). Sem ordem
  total, a mesma movimentacao cairia em categorias diferentes entre execucoes.
- **O automatico nunca sobrescreve divisao feita a mao** -- so a correcao
  manual sobrescreve, porque ai quem pediu foi o Rick.
- **"Criar regra" nao reclassifica o passado**, por ser literal ao pedido
  ("regra para as proximas").
- Regra sem condicao e regra sem acao sao recusadas; editar valida o
  RESULTADO da mesclagem, nao so o patch.
- `resolvedBy` diz qual nivel decidiu cada campo -- e o que vai permitir a tela
  explicar a classificacao.

A importacao (fase 3) passou a disparar a classificacao do lote por porta
estreita (`TransactionClassifier`), best-effort: falha ali deixa as linhas
PENDING, nunca desfaz a importacao.

Achado do proprio teste: a fabrica de transacao do teste de classificacao
estava sem `...over`, entao todo objeto voltava com os valores padrao -- tres
testes falharam e apontaram direto pra causa.

Migration `20260827220000_add_personal_classification_rules` **aplicada em
producao** (aditiva: 1 tabela, 1 enum, 3 CHECKs, RLS verificados). 64 testes
novos -> **793 na API** (1052 no monorepo). type-check, lint e build limpos.

**Ainda nao ha tela** -- telas sao a fase 8.

## Trabalho de 27/08/2026 — Cofre Financeiro, Fase 5 (assinaturas e alertas)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**.

**Primeiro, o vazamento anotado na fase 1 foi fechado**: `PushSender` so tinha
`sendToOrg` e um alerta de assinatura pessoal iria pro navegador de toda a
equipe. A porta ganhou `sendToUser`, e o Cofre so usa essa.

Decisoes que valem lembrar:

- **A verificacao a cada abertura do app e a GARANTIA; push e a segunda
  camada.** No free tier o worker dorme, entao ele nunca pode ser a unica via.
  Como o calculo roda a toda abertura, a idempotencia deixa de ser detalhe e
  vira o que impede a tela de encher -- garantida por `dedupeKey`
  (`tipo:ancora:data`) com unique no banco.
- **Uma cobranca nunca vira assinatura.** Duas compativeis viram SUGESTAO,
  nunca cadastro automatico: assinatura criada sozinha geraria alertas que
  ninguem pediu, com valor e data que ninguem conferiu.
- **Valor esperado e o da cobranca mais recente, nao a media.** Media puxaria o
  esperado pra baixo depois de reajuste e geraria alerta de variacao na
  cobranca seguinte, que estaria certa.
- **Renovacao sai da cobranca que realmente aconteceu**, e extrato antigo nao
  empurra a proxima renovacao pra tras.
- Folgas que evitam alerta ruim: pausada nao alerta, cobranca faltando tem 3
  dias de tolerancia, duplicata e um aviso por PAR (e um por mes), tolerancia
  de preco padrao 10% (assinatura em dolar oscila todo mes).
- **`costSubscriptionId` sem FK**: `cost_subscriptions` e da organizacao e a
  assinatura pessoal e do Cofre -- FK entre os dois mundos daria ao banco um
  caminho de leitura que a aplicacao existe pra impedir. Resolvido na fase 7.

O nivel 4 da cascata (SUBSCRIPTION) deixou de ser `null`, e a regra ganhou
`setSubscriptionId` -- a coluna aditiva prometida na fase 4. O exemplo do
Claude fecha ponta a ponta com teste.

Migration `20260828010000_add_personal_subscriptions` **aplicada em producao**
(aditiva: 2 tabelas, 4 enums, 2 colunas anulaveis, 5 CHECKs, RLS verificados).
80 testes novos -> **873 na API** (1132 no monorepo). type-check, lint e build
limpos.

**Ainda nao ha tela** -- telas sao a fase 8.

## Trabalho de 27/08/2026 — Cofre Financeiro, telas (antecipadas da fase 8)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**. Decisao
do Rick: puxar as telas pra antes das fases 6, 7 e 9 -- cinco fases de API sem
nada visivel era tempo demais. **O Cofre agora e usavel de ponta a ponta.**

Dez rotas sob `/cofre`: visao geral, movimentacoes (com revisao e correcao),
importar, assinaturas, alertas, contas, cartoes, categorias, fornecedores,
regras.

Decisoes:

- **A porta mora no `cofre/layout.tsx`**, nao em cada pagina: tela nova nasce
  protegida sem ninguem lembrar, e o conteudo do Cofre nem chega a ser montado
  com ele fechado. E no layout que a verificacao de alertas roda ao abrir --
  primeiro nivel de entrega.
- **A visao geral comeca pelo que exige acao**, nao por saldo. Saldo voce ja
  sabe; o que voce nao sabe e o que esta esperando por voce.
- **O regime (competencia x caixa) fica visivel o tempo todo** -- tela que nao
  diz qual numero esta mostrando engana.
- Pre-visualizacao da importacao e **mutation, nao query**: como query, o React
  Query guardaria o conteudo do extrato em cache.

**Dois bugs reais que a UI expos e que foram corrigidos:**

1. `formatDate` do app converte pra fuso local. As colunas do Cofre sao
   `@db.Date` (meia-noite UTC), entao em UTC-3 **todo lancamento apareceria um
   dia antes**. Criado `formatVaultDate` com `timeZone: "UTC"` fixo, com teste.
2. Extrato de banco brasileiro costuma vir em ISO-8859-1. Lido como UTF-8, o
   acento vira `?` -- e como a descricao entra no fingerprint, a reimportacao
   duplicaria tudo. Criado `decodeBankFile` (UTF-8 estrito com fallback pra
   Windows-1252), com teste.

16 testes novos no web -> **198 no web, 1148 no monorepo**. type-check, lint
(0 avisos) e build limpos; as 10 rotas aparecem no output do build.

## Trabalho de 27/08/2026 — Cofre Financeiro, Fase 6 (dividas)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**. Tres
tabelas (`personal_contacts`, `personal_debts`, `personal_debt_payments`),
migration aditiva `20260828070000_add_personal_debts` aplicada, duas telas
novas (`/cofre/dividas`, `/cofre/pessoas`).

A regra que organiza a fase: **baixa de divida nao e fato economico novo**. O
Pix que quita nao e renda, e pagar uma divida minha nao e despesa nova -- nos
dois casos o dinheiro ja foi contado quando a divida nasceu. Quem decide e
`classifyCashFlow`, uma funcao so com quatro respostas exclusivas; o que
sustenta no banco e o UNIQUE em `personal_debt_payments.transaction_id` (uma
movimentacao baixa no maximo uma divida -- sem isso, R$200 baixariam R$400).

Decisoes:

- **Valor pago, saldo e status nao sao colunas.** Uma divida vira ATRASADA pela
  passagem do tempo, sem ninguem escrever nada -- uma coluna `status` estaria
  errada toda madrugada e mentiria justamente nas dividas esquecidas. So o
  cancelamento e coluna, porque so ele e um evento.
- **A soma das baixas nao pode passar do valor** e a unica invariante de
  dinheiro do modulo que o Postgres nao defende sozinho (relaciona duas
  tabelas; CHECK so ve a propria linha). Fica no servico, com teste.
- Devolver a mais **nao** vira credito na direcao oposta: o saldo trava em zero
  e o excedente aparece como `overpaid`, pra ser resolvido na mao.
- **Compra reembolsavel fecha o ciclo**: criar a divida a receber a partir de
  uma compra marca a divisao REIMBURSABLE na mesma operacao, preservando o
  rateio que ja existia. Sem isso, os R$300 do jantar continuariam contados
  como gasto seu enquanto a tela de dividas jurava que alguem te deve R$100.
- **Nenhum dado sensivel de terceiro**: `personal_contacts` tem nome, contato
  em texto livre e observacoes. Sem CPF, conta ou chave Pix.

**A licao da fase 5 foi aplicada antes de doer.** A FK da baixa e RESTRICT, e
erro de constraint sobe como 500 -- foi assim que a exclusao de conta quebrou.
Desta vez a checagem veio antes: apagar movimentacao que baixa divida responde
409 dizendo qual divida esta no caminho, e apagar pessoa com divida responde
409 sugerindo desativar. Quem pergunta e a porta `DebtLinkChecker`.

60 testes novos na API -> **933 na API, 1208 no monorepo**. type-check, lint,
build e as 12 tarefas do turbo limpos. Validacao de ponta a ponta pelo BFF
(mesmo caminho do navegador): **19/19**, incluindo a regressao do 409 e a
limpeza dos dados de teste (Cofre voltou a zero).

## Trabalho de 27/08/2026 - Cofre Financeiro, Fase 7 (ponte com o financeiro)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**. Duas
tabelas (`business_expenses`, `personal_business_allocations`), migration
aditiva `20260828100000_add_business_expense_bridge` aplicada, uma tela nova
(`/cofre/milweb`) e uma secao nova no Centro de Custos ("Realizado no mes").

O problema: uma compra pessoal pode ter uma parte da empresa (o Claude no
cartao pessoal). Essa parte precisa entrar no custo da MilWeb sem que o
financeiro enxergue o resto da sua vida.

Decisoes:

- **A despesa empresarial NAO tem coluna apontando pro Cofre.** Quem guarda o
  elo e a `PersonalBusinessAllocation`, lida so pelo Cofre. Quem ve o
  financeiro le "Claude Pro - R$120 - origem: Cofre pessoal" e nao chega em
  mais nada. Que a despesa saiu do bolso do dono e fato contabil legitimo; o
  que MAIS tinha naquela fatura nao e.
- **Vai so a parte da empresa**, nunca o valor da compra. Mandar R$300 quando
  so R$100 e da MilWeb cobraria dela um dinheiro que ela nao deve -- e o numero
  seria plausivel demais pra alguem notar no fechamento.
- **Planejado x realizado nunca somam.** `CostSubscription` e o plano e continua
  sozinho em `computeSummary`; `BusinessExpense` e o realizado e tem resumo
  proprio, com a diferenca sendo SUBTRACAO. Somar daria dois Claudes. Ha teste
  varrendo os campos do resumo pra garantir que nenhum e a soma dos dois.
- **UNIQUE na movimentacao, nao na divisao.** As divisoes sao substituidas em
  bloco: corrigir o rateio troca o id da divisao, e uma chave baseada nela
  deixaria a mesma compra ser enviada de novo. Segundo envio e 409; se o rateio
  mudou, sincroniza (atualiza) ou desfaz.
- **Divergencia nao e corrigida sozinha**: aparece como "desatualizada" com os
  dois numeros a vista. Reescrever a contabilidade da empresa sem ninguem pedir
  e pior -- o mes pode ja ter fechado com o numero antigo.
- **O UNICO pedaco do Cofre com RBAC.** Escrever no financeiro e escrever dado
  da organizacao; sem checar permissao, a ponte seria atalho pra contornar o
  RBAC do Centro de Custos. Router separado (`vault-bridge-routes.ts`) com tres
  camadas: authenticate + requireVault + requirePermission. Usa a permissao que
  ja existe (`proposals:*`), nao uma chave nova -- chave nova entraria sozinha
  em `ADMIN_PERMISSIONS`.

**Lacuna da fase 5 fechada**: `personal_subscriptions.cost_subscription_id` era
aceito sem conferir nada; agora passa pela porta `CostSubscriptionVerifier`.

**Uma inconsistencia real corrigida**: o `Decimal` do Prisma corta zero a
direita, entao `100.00` voltava como `"100"` -- o mesmo valor aparecia como
"R$ 100" no financeiro e "R$ 100,00" no Cofre. Encontrada rodando o app.

52 testes novos na API -> **985 na API, 1260 no monorepo**. type-check, lint,
build e as 12 tarefas do turbo limpos. Validacao de ponta a ponta pelo BFF:
**24/24**, com os dados de teste limpos.

## Trabalho de 27/08/2026 - Cofre Financeiro, Fase 9 (backup e exportacao)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**. Nenhuma
tabela nova: duas rotas (`POST /vault/backup/export` e `/restore`) e uma tela
(`/cofre/backup`).

Decisoes:

- **A senha e pedida de novo**, mesmo com o Cofre aberto. A sessao elevada da
  leitura tela a tela; a exportacao transforma "notebook destravado por tres
  minutos" em "historico financeiro inteiro num arquivo". A confirmacao usa o
  MESMO balde de tentativas do desbloqueio -- contador proprio faria da
  exportacao um oraculo de senha sem penalidade. E nao renova a sessao.
- **`omit`, nao `select`, no dump.** Com `select`, coluna nova no schema faz o
  backup sair incompleto em silencio, e so se descobre no dia de restaurar. Com
  `omit`, ela entra sozinha e o modo de falhar vira "veio coisa demais". Num
  backup os dois nao sao equivalentes.
- **Restaurar so em Cofre vazio.** Mesclar duplica dinheiro em silencio (a
  mesma compra entra duas vezes, com ids diferentes, e nenhum fingerprint pega
  porque o backup traz os originais); sobrescrever destroi o que esta la.
  Recusar e a unica resposta que nao perde nem inventa dado.
- **Versao no envelope**: versao desconhecida e recusada em vez de adivinhada.
- **CSV com escape de formula.** Excel trata `=`, `+`, `-`, `@` no comeco de
  campo como formula, e a descricao vem do extrato -- texto de terceiro.
  `=HYPERLINK(...)` viraria link ativo na planilha de quem abrisse.
- **Nome do arquivo nao denuncia nada** (`millead-AAAA-MM-DD.json`), resposta
  com `Cache-Control: no-store`, e POST em vez de GET pra senha nao ir na URL.
- **Dois contadores de rate limit**, separados: um balde so faria uma sequencia
  de exportacoes travar a restauracao -- que e o que se faz na pior hora
  possivel.

**Um bug que so a execucao encontrou**: a planilha respondia 500 enquanto o
JSON, do MESMO dump, saia normal. O Prisma devolve `Decimal`; `JSON.stringify`
chama o `toJSON()` dele sozinho, e o CSV faz `.replace()` na string. Corrigido
convertendo todo Decimal do dump em string de duas casas -- o que tambem
resolve o corte de zero a direita, o mesmo problema da fase 7.

38 testes novos na API -> **1023 na API, 1298 no monorepo**. type-check, lint,
build e as 12 tarefas do turbo limpos. Validacao de ponta a ponta pelo BFF:
**28/28**, incluindo o ciclo completo (exportar -> esvaziar -> restaurar ->
conferir que rateio, divida, baixa e apelido voltaram ligados).

## Trabalho de 27/08/2026 - Cofre Financeiro, Fase 10 (painel e revisao final)

Mesma branch `feat/cofre-financeiro`, **nao mergeada, nao deployada**. O
modulo esta COMPLETO: as dez fases em `✓`.

Duas entregas:

**1. O painel do mes** (`GET /vault/summary`, na visao geral do Cofre). E o
unico lugar onde as regras de todas as fases se aplicam ao mesmo tempo, e por
isso o unico onde a contagem dupla apareceria. Existe em torno de uma
identidade que precisa fechar ao centavo:

    saidas = consumo pessoal + parte da empresa + reembolsavel

Transferencia, baixa de divida e estorno ficam fora de entradas/saidas -- mas
as duas primeiras aparecem numa linha propria, porque esconde-las faria a
pessoa procurar dinheiro que saiu da conta e nao esta em lugar nenhum da tela.
"Entrou e saiu" e "consumo pessoal" aparecem lado a lado de proposito: sao
respostas a perguntas diferentes, e o modulo inteiro foi desenhado pra que nao
se misturem.

**2. Varredura de seguranca** das 19 tabelas e de todas as rotas:

- RLS em 19/19 tabelas (a checagem inicial deu falso positivo em 16 enums --
  refeita separando `model` de `enum`)
- Nenhum lugar le `vaultId` do corpo da requisicao
- Nenhuma consulta Prisma sem filtro de posse (2 apontadas, as duas falso
  positivo: `where` destruturado e o `findByOwner` do proprio Cofre)
- Nenhuma rota de dados sem sessao elevada; nenhuma com RBAC fora da ponte
- Zero `console.log`, zero senha em query string, auditoria so com contadores

15 testes novos -> **1038 na API, 1313 no monorepo**. type-check, lint, build e
as 12 tarefas do turbo limpos. Validacao de ponta a ponta pelo BFF: **14/14**,
incluindo a identidade fechando contra a API real (365 + 150 + 75 = 590).

### O modulo em numeros

19 tabelas · 8 migrations · 80 rotas · 14 telas · 572 testes do Cofre.

## Bloqueios

- Pendências registradas em memória (`millead-pendencias-seguranca`) ainda em aberto: ZapSign não configurado no Render (contratos não são assináveis de verdade em produção), 2 achados baixos de segurança (landing de IA sem sanitização própria, tokens em localStorage), permissões próprias de Contratos/Landing pages pendentes de migração.

## Próxima ação

**Usar o Cofre com dados reais.** As dez fases estao prontas e validadas; o
que falta e o Rick importar os extratos dele. O caminho:
`/cofre` -> Contas -> Importar (OFX do banco) -> revisar as classificacoes.

Duas coisas continuam pendentes de decisao dele:

1. **Validacao visual em navegador** -- a extensao do Chrome nao conecta.
   As 14 telas respondem 200 e todos os fluxos foram exercitados pelo BFF, mas
   ninguem olhou os pixels.
2. **Apagar o Cofre** nao existe. O comentario do schema diz "ver a exportacao
   antes de apagar", mas a exclusao em si nao foi construida -- e destrutiva e
   irreversivel, e merece decisao propria.

Se for usar em producao (millead.milweb.com.br), falta: `VAULT_SESSION_SECRET`
no Render, e merge + deploy da branch.

Antes de usar: definir `VAULT_SESSION_SECRET` no `.env` (ja feito localmente)
e no Render. Sem ela o modulo inteiro responde 404 de proposito.

Continua pendente: **validacao visual em navegador** -- a extensao do Chrome
nao esta conectada, entao nenhuma tela do Cofre foi olhada de verdade ainda.
As 12 rotas respondem 200 e o fluxo foi exercitado pelo BFF, mas ninguem viu
os pixels.

Antes de usar o Cofre e preciso definir `VAULT_SESSION_SECRET` no `.env` e no
Render — sem ela o modulo inteiro responde 404 de proposito.

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
