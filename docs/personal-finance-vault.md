# Cofre Financeiro

Área privada do MilLead para as finanças **pessoais** do dono da conta. Nasceu
de uma exigência simples e incomum no resto do sistema: nenhum membro da
equipe pode ver, consultar ou inferir o que está aqui — nem quem tem papel
Owner ou Admin na organização.

> **Estado atual: fases 1 a 5 de 10, mais as telas.** Segurança, núcleo
> financeiro, importação, classificação, assinaturas com alertas **e a
> interface** — o Cofre já é usável de ponta a ponta. Dívidas, integração com o
> financeiro da MilWeb e exportação são as fases seguintes — ver
> [Roadmap](#roadmap).

## A decisão que define o módulo: sem RBAC

Todo o resto do MilLead autoriza por permissão (`requirePermission("leads:read")`).
O Cofre **não**, e isso não é economia de trabalho.

`packages/database/src/permissions.ts` define:

```ts
const ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter((k) => k !== PERMISSIONS.BILLING_MANAGE);
```

Ou seja: **qualquer chave nova no catálogo entra automaticamente no papel
Admin de toda organização**. Uma permissão `vault:read` não protegeria o
Cofre — publicaria ele.

Então a autorização aqui tem duas partes, e nenhuma delas é papel:

1. **Posse** — `PersonalVault.ownerUserId`, com `@unique`. Cada usuário cria o
   seu; ninguém enxerga o de ninguém. Não existe "o" Cofre do sistema.
2. **Sessão elevada** — um segundo token, de escopo próprio, obtido
   reautenticando com a senha da conta.

Por isso `personal_vaults` também é a única tabela do schema **sem**
`organizationId`. A coluna significaria "este dado pertence à organização", e
é exatamente disso que o Cofre precisa não participar: com ela, qualquer
repositório que filtrasse por tenant — o padrão da casa — devolveria dado
financeiro pessoal a quem tem papel na empresa.

`OWNER_EMAIL` / `NEXT_PUBLIC_OWNER_EMAIL` (o gate do MilSocial) **não é
reusado**: dono configurado por variável de ambiente não sobrevive a uma troca
de e-mail nem a um deploy mal configurado, e transforma um `.env` errado em
vazamento.

## As duas portas

```
requisição
   │
   ├─ authenticate ......... sessão normal do app (cookie ml_at -> Bearer)
   │                          ↓ req.auth.userId
   └─ requireVault ......... posse + sessão elevada (cookie ml_vs -> header)
                              ↓ req.vault
```

`requireVault` (`interfaces/http/middlewares/require-vault.ts`) exige as duas
ao mesmo tempo e confere que são **do mesmo usuário**. Sem essa conferência,
um token de Cofre roubado bastaria sozinho: o atacante entraria com a conta
dele e leria o Cofre de quem teve o token vazado.

### Por que 404 e não 403

Toda negativa de posse responde **404 com a mensagem genérica "Rota não
encontrada."** — a mesma de uma rota que não existe. Um 403 confirmaria que
existe um Cofre ali. Não há como distinguir, de fora, entre:

- o Cofre não existe;
- existe, mas é de outra pessoa;
- existe, é seu, mas está desativado;
- `VAULT_SESSION_SECRET` não está configurado no servidor.

A única exceção é **401 `VAULT_LOCKED`**, e ela só é emitida **depois** de a
posse estar confirmada: significa "é seu, só reautentique". O front usa esse
código pra abrir a tela de desbloqueio em vez de deslogar.

## Sessão elevada

| Aspecto    | Escolha                                                 | Por quê                                                                                                                |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Segredo    | `VAULT_SESSION_SECRET`, separado do `JWT_ACCESS_SECRET` | Vazar um não entrega o outro. O schema de env **recusa os dois iguais** em produção.                                   |
| Escopo     | `personal-finance`, conferido explicitamente            | Um token do mesmo segredo emitido pra outra finalidade não abre o Cofre por acidente.                                  |
| TTL        | 15 min de **inatividade**                               | `requireVault` reassina a cada request autorizada e devolve no header `x-vault-session-renew`; o BFF regrava o cookie. |
| Transporte | Cookie httpOnly `ml_vs`, `sameSite: strict`             | O JS do navegador nunca vê o token — um XSS não consegue exfiltrar a chave do Cofre.                                   |
| Revogação  | `PersonalVault.sessionsInvalidatedAt`                   | Todo token com `iat` anterior ao corte morre na hora.                                                                  |

**Sem `VAULT_SESSION_SECRET` o módulo inteiro responde 404.** É o inverso do
padrão dos outros opcionais (IA e SMTP viram no-op): aqui, degradar
significaria servir dado financeiro sem a segunda barreira.

### "Bloquear agora" é revogação de verdade

Limpar o cookie seria teatro — um token já emitido (copiado de um dispositivo
perdido) continuaria válido pelos minutos restantes. O botão empurra
`sessionsInvalidatedAt` pra frente no banco, e `requireVault` recusa tudo que
foi emitido antes disso.

O mesmo corte acontece em dois outros momentos, pela porta estreita
`domain/services/vault-locker.ts` (que existe pra que `LogoutUseCase` e
`ChangePasswordUseCase` não passem a depender do módulo financeiro inteiro só
pra cortar uma sessão):

- **Logout** — sair da conta fecha o Cofre no servidor.
- **Troca de senha** — o Cofre reautentica com a senha da conta, então a senha
  antiga, já comprometida, não pode deixar um Cofre aberto que a troca não
  alcança.

Um desbloqueio bem-sucedido zera `sessionsInvalidatedAt`: sem isso, bloquear e
reabrir dentro do mesmo segundo devolveria um token que o próprio corte
recusa (o `iat` do JWT tem resolução de segundos; o corte, de milissegundos).

## Limite de tentativas

Duas travas, de propósito diferente:

1. **Lockout escalonado, persistido** (`application/services/vault-lockout.ts`)
   — 5 tentativas, depois 1 → 5 → 15 → 60 minutos, saturando no maior degrau.
   Fica no banco, não em memória: a API roda no Render free, o processo dorme
   e reinicia sozinho, e um balde em memória devolveria tentativas de graça a
   cada cold start — exatamente quando um atacante paciente estaria tentando.
   O escalonamento evita os dois extremos: teto fixo que tranca o dono pra
   sempre, ou janela curta demais pra atrapalhar quem automatiza.
2. **Rate limit por usuário** (`vaultUnlockRateLimit`) — corta volume antes de
   chegar ao bcrypt, inclusive de contas que não têm Cofre e portanto não têm
   contador.

O contador é incrementado **atomicamente no banco**
(`incrementFailedAttempts`). Um `lê → soma → grava` na aplicação permitiria a
quem dispara tentativas em paralelo sobrescrever o próprio contador e nunca
chegar ao bloqueio.

Durante o bloqueio, a senha **não é comparada** — sem isso o lockout viraria
um amplificador de CPU para quem continua martelando a rota.

A resposta de erro nunca conta quantas tentativas restam: isso ajudaria mais
quem ataca do que quem esqueceu a senha. O dono vê o contador na tela, que
consulta `GET /vault/status`.

## Auditoria

O Cofre é auditado, mas **fora da trilha da organização**:

- `organizationId` é sempre `null` (`PersonalVaultService.auditContext`). A
  atividade financeira pessoal do dono não pertence à empresa.
- Nenhum valor, saldo, descrição bancária ou senha é gravado. Os metadados vão
  até `{ failedAttempts, locked }`, e há teste que falha se algo financeiro
  aparecer.
- O middleware global `audit-mutations` **exclui `/api/v1/vault/*`** — ele
  grava `auth.organizationId` e o path em toda mutação, e sem a exclusão
  colocaria a vida financeira pessoal num log de escopo corporativo.

Ações registradas: `vault.created`, `vault.unlocked`, `vault.unlock_failed`,
`vault.unlock_blocked`, `vault.locked`.

`AuditLog` não tem rota de leitura em lugar nenhum da API, então não existe
caminho pelo qual a equipe possa consultar essas linhas.

## API

Todas exigem sessão autenticada. Nenhuma exige permissão RBAC.

| Rota                        | Barreira                   | Resposta                                                                     |
| --------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `GET /api/v1/vault/status`  | posse                      | Estado da tela bloqueada. **Nada financeiro** — é lida antes do desbloqueio. |
| `POST /api/v1/vault`        | sessão                     | Cria o Cofre do usuário autenticado. Idempotente.                            |
| `POST /api/v1/vault/unlock` | posse + rate limit         | Devolve a sessão elevada no corpo; o BFF a transforma em cookie.             |
| `POST /api/v1/vault/lock`   | posse                      | Corta as sessões elevadas. 204.                                              |
| `GET /api/v1/vault/session` | posse + **sessão elevada** | `{ open: true }`. Primeira rota sob `requireVault`.                          |

**Nunca aceite `ownerUserId` do corpo.** Não existe parâmetro de dono em
nenhuma rota: o dono é sempre `req.auth.userId`. As rotas de dados das
próximas fases entram sob o mesmo `requireVault`, e devem filtrar por
`req.vault.ownerUserId` — os dois coincidem, mas só o segundo prova que a
reautenticação aconteceu.

## Frontend

- **Rota `/cofre`**, fora da navegação lateral. O acesso é uma entrada
  discreta no menu do próprio usuário. O item aparece pra qualquer usuário
  logado de propósito: o Cofre é individual, o item não revela dado de
  ninguém, e é por ele que se cria o Cofre na primeira vez. Quem protege é a
  API.
- **Quem decide o que aparece é o servidor** (`GET /vault/session`), não
  estado local: recarregar a página não abre o Cofre.
- **A tela bloqueada não mostra nada financeiro** — nem como esqueleto de
  carregamento. Quem olha por cima do ombro não aprende nada além de que
  existe um Cofre.
- **Fechar limpa o cache** do React Query (`removeQueries(["vault"])`), senão
  os dados da última sessão reapareceriam por um instante no próximo acesso,
  antes da nova autenticação.
- O `api-client` trata `401 VAULT_LOCKED` **sem** tentar refresh: o login
  continua válido, e sem essa saída cada request ao Cofre fechado gastaria um
  refresh (rotacionando o refresh token à toa).

## Núcleo financeiro (fase 2)

Oito tabelas: contas, cartões, categorias, fornecedores, aliases,
movimentações, divisões e faturas. Todas penduradas em `vaultId`, e todas as
rotas atrás de `requireVault`.

### Decisões que mudam o resultado da conta

**Nenhum booleano "é empresarial" na movimentação.** A `PersonalTransaction`
não guarda `isBusiness` nem `isReimbursable`: quem manda no rateio são as
`PersonalTransactionSplit`, e os indicadores são **derivados** a cada leitura
(`split-allocation.ts`). Dois lugares dizendo a mesma coisa é como nasce
contagem dupla — o risco número um deste módulo. A API continua devolvendo
`isBusiness`, `businessAmount` e `personalConsumption`; eles só não existem no
banco. Sem divisão nenhuma, a movimentação é 100% pessoal; com divisões
parciais, o resto continua pessoal.

**Valor sempre positivo, direção explícita.** Sinal negativo é ambíguo entre
bancos (uns mandam crédito negativo, outros débito) e vira erro silencioso de
soma. `direction` (`IN`/`OUT`) não tem como ser mal lida, e um CHECK garante
`amount > 0`.

**Dinheiro é somado em centavos inteiros** (`vault-money.ts`). `0.1 + 0.2` em
ponto flutuante é `0.30000000000000004`, e um total que erra no último centavo
passa despercebido até alguém conferir na mão.

**Datas em UTC, sempre** (`vault-date.ts`). `new Date(2026, 7, 27)` usa o fuso
da máquina: num servidor a leste do meridiano a data "anda" um dia pra trás e o
lançamento troca de mês. Tudo usa `Date.UTC`.

**Total de fatura é recalculado, nunca incrementado.** Um acumulador
dessincroniza no primeiro estorno e ninguém percebe até a fatura não bater com
o banco.

**Pagamento de fatura não é despesa nova.** A compra no cartão já foi a
despesa; o pagamento é o dinheiro saindo da conta. A saída nasce
`isTransfer: true` e **não** é vinculada à fatura que quita — vinculá-la
somaria o pagamento ao total que ele paga.

**Transferência entre contas próprias são duas linhas**, ligadas por
`transferPairId`, ambas `isTransfer`. As duas contas precisam do lançamento
para bater com o extrato, e a marca as mantém fora dos totais de receita e
despesa. A listagem esconde transferências por padrão.

### O que nunca é guardado

Número completo de conta; número completo, validade ou código de segurança de
cartão. Só `last4`, e só para você distinguir dois cartões do mesmo banco na
tela.

### Categorias: por que `systemKey`

Você pode renomear qualquer categoria. Por isso a lógica nunca procura por
nome: "Transferências" tem `systemKey: "transfer"`, e renomear para
"Movimentação interna" não quebra nada. Categorias que você criar têm
`systemKey` nulo — nenhuma regra depende delas. A árvore tem **um nível só**; o
service recusa subcategoria de subcategoria.

A árvore padrão nasce junto com o Cofre, pela porta `VaultProvisioner`, e o
provisionamento é idempotente e auto-corretivo: `POST /vault` semeia sempre,
inclusive quando o Cofre já existia, então uma falha de rede numa tentativa
anterior se conserta sozinha em vez de deixar um Cofre sem categoria nenhuma.

### Deduplicação (a base da fase 3)

`fingerprint` tem **um índice só** (`@@unique([vaultId, fingerprint])`) com
duas estratégias: com FITID a chave é derivada só dele (banco que reescreve a
descrição continua sendo a mesma transação); sem FITID, sai de origem + data +
valor + direção + descrição normalizada. A prioridade mora em como a chave é
montada, não numa regra de leitura que algum caminho novo possa esquecer.

Em lançamento manual o fingerprint é **nulo**: dois cafés de R$5 no mesmo dia
são duas despesas reais, e um unique pegaria o segundo como duplicata.

### Invariantes no banco

Seis CHECKs, porque são regras de dinheiro — deixá-las só na aplicação
significa que um bug futuro grava número errado em silêncio:

| Constraint                                   | Impede                                                   |
| -------------------------------------------- | -------------------------------------------------------- |
| `personal_transactions_origem_unica`         | linha sem origem, ou contada duas vezes (conta E cartão) |
| `personal_transactions_valor_positivo`       | valor zero ou negativo                                   |
| `personal_transactions_parcela_coerente`     | "parcela 13 de 12"                                       |
| `personal_transaction_splits_valor_positivo` | divisão que não divide nada                              |
| `personal_credit_cards_dias_validos`         | fechamento/vencimento fora do calendário                 |
| `personal_statements_valores_nao_negativos`  | fatura com pagamento negativo                            |

### Cadastro com histórico não se apaga

Conta, cartão e categoria em uso respondem **409 com instrução de desativar**,
nunca apagam junto o histórico. A FK é `Restrict` de propósito.

### API do núcleo

Tudo sob `/api/v1/vault`, tudo atrás de `requireVault`, nada com RBAC.

| Recurso       | Rotas                                                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Contas        | `GET/POST /accounts`, `GET/PATCH/DELETE /accounts/:id`                                                                            |
| Cartões       | `GET/POST /cards`, `GET/PATCH/DELETE /cards/:id`                                                                                  |
| Categorias    | `GET/POST /categories`, `PATCH/DELETE /categories/:id`                                                                            |
| Fornecedores  | `GET/POST /merchants`, `GET/PATCH/DELETE /merchants/:id`, `POST /merchants/:id/aliases`, `DELETE /merchants/:id/aliases/:aliasId` |
| Movimentações | `GET/POST /transactions`, `GET/PATCH/DELETE /transactions/:id`, `PUT /transactions/:id/splits`, `POST /transactions/transfers`    |
| Faturas       | `GET /statements`, `GET /statements/:id`, `POST /statements/:id/payments`                                                         |

A listagem aceita `basis=ACCRUAL|CASH` (competência ou caixa), intervalo de
datas, conta, cartão, categoria, fornecedor, fatura, status, direção, busca e
paginação. **Os dois regimes nunca se misturam sem rótulo** — o filtro decide
qual coluna de data é usada, inclusive na ordenação.

## Importação de OFX e CSV (fase 3)

Dois passos — **pré-visualizar** e **confirmar** — e um princípio que decide o
resto do desenho.

### O arquivo nunca é guardado

Nem em disco, nem em storage, nem numa tabela de rascunho entre os dois
passos. Ele chega como texto no corpo JSON (não multipart, que pediria o
`@vercel/blob` que os briefings usam), existe na memória do processo durante a
requisição, e acaba ali.

O que fica é o **lote** (`personal_import_batches`): hash do conteúdo, nome
higienizado, período, formato, contagens e erros por número de linha. Nada
disso reconstrói o extrato.

Isso tem uma consequência de engenharia explícita: a pré-visualização devolve
as linhas já interpretadas e a confirmação manda de volta as que você aceitou.
**O servidor não confia no que volta** — fingerprint é recalculado, duplicatas
são reconferidas contra o banco no momento da gravação, e a origem é
revalidada como sua. O cliente escolhe _quais_ linhas entram; ele não decide o
que elas são.

A alternativa (guardar o arquivo entre os passos) pediria um lugar para estado
temporário que é justamente o dado mais sensível do Cofre, com prazo de
validade e rotina de limpeza para manter. Não vale.

### Erros de linha são códigos, nunca conteúdo

`{ line: 12, code: "VALOR_INVALIDO" }`. Um log de importação com a linha crua
seria o extrato de volta por outra porta — e há teste que falha se a descrição
do banco aparecer no erro.

Códigos: `COLUNA_AUSENTE`, `DATA_INVALIDA`, `VALOR_INVALIDO`,
`DESCRICAO_VAZIA`.

### Parsers próprios, sem dependência nova

- **OFX** cobre as duas versões: 1.x é SGML com tags que não fecham
  (`<FITID>123` e acabou), 2.x é XML. Um parser XML quebraria no 1.x, que é
  justamente o mais comum nos bancos brasileiros. A leitura para no primeiro
  `<` ou na quebra de linha, o que funciona nos dois.
- **CSV** trata aspas, aspas duplicadas, quebra de linha dentro do campo, CRLF
  e BOM (o que o Excel gera). São ~60 linhas; a alternativa era mais um pacote
  na cadeia de suprimento de um módulo que lê extrato bancário.

Nenhum dos dois interpreta valor ou data: as strings saem cruas e a conversão
é a mesma para OFX e CSV. Duas conversões para o mesmo campo seriam duas
chances de divergir.

### Separador de coluna é escolhido por consistência, não por contagem

Num extrato brasileiro (`27/08/2026;MERCADO;1.234,56`) a vírgula decimal
aparece em toda linha, então contar ocorrências elegeria a vírgula e cada
linha quebraria num lugar diferente. O separador certo é o que produz **o
mesmo número de colunas em todas as linhas**.

### Na dúvida, recusar a linha

Valor com separador ambíguo (`1,2,3`), data que não existe (`31/02`), débito e
crédito preenchidos ao mesmo tempo, três casas decimais: tudo vira linha
recusada com código, e aparece na revisão. Um palpite errado vira valor torto
no meio de centenas de linhas certas — o pior tipo de erro, porque não chama
atenção.

Linha de valor zero também é descartada: costuma ser linha de saldo que o
banco enfia no meio do extrato.

### Mapeamento conferido contra o cabeçalho

Antes de ler linha nenhuma, o serviço confere que toda coluna do mapeamento
existe no cabeçalho — casando sem acento e sem caixa ("Histórico" =
"HISTORICO").

É o que separa dois problemas que pareceriam o mesmo: **o arquivo não é um
extrato** (a página de sessão expirada do banco é HTML, vira uma linha só e
passa pelo leitor de CSV sem reclamar) e **o mapeamento aponta pra coluna
errada**. Sem a checagem, os dois viriam como zero linhas ou como N linhas
inválidas, e você conferiria linha por linha um problema que é do arquivo
inteiro.

Feito ali, e não dentro do mapeamento, porque **mês sem movimentação é
legítimo**: cabeçalho certo e nenhuma linha é resultado vazio, não erro.

### Modelos de importação

CSV de banco não tem padrão: cada um escolhe separador, ordem da data, vírgula
ou ponto decimal, e se débito vem negativo ou em coluna própria. O perfil
(`personal_import_profiles`) guarda isso por banco/cartão, para você não
remapear toda vez — o tipo de atrito que faz a pessoa parar de importar.

Suporta coluna única com sinal **ou** o par débito/crédito, e `invertSign`
para os bancos que mandam despesa positiva.

### Deduplicação em duas camadas

| Camada                | O que faz                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Pré-visualização      | Mostra as duplicatas **antes** de confirmar, separando "já está no Cofre" de "repetida dentro do arquivo" |
| `createMany` + unique | **Impede** que entrem                                                                                     |

A segunda é a que garante. Entre a conferência e a confirmação passam minutos,
e nesse intervalo a mesma linha pode ter entrado por outro caminho — a
checagem é para você _ver_; o unique `(vaultId, fingerprint)` com
`skipDuplicates` é o que faz a importação ser idempotente no nível do banco.
Duplo clique em "Confirmar" não cria a movimentação duas vezes.

### O que a importação grava

Linhas importadas nascem **`PENDING`**: vieram do banco, mas ainda não
passaram pela sua revisão de categoria — quem confirma é a fase 4. Cada uma
aponta para o lote de origem (`importBatchId`), que é a procedência.

Extrato de conta ganha `settlementDate` (o banco reporta o que já compensou);
fatura de cartão, não — e cada compra já nasce ligada à fatura certa, resolvida
pelo dia de fechamento, com uma consulta por mês de referência e não por linha.

### API

| Rota                                       | O que faz                                                    |
| ------------------------------------------ | ------------------------------------------------------------ |
| `POST /vault/imports/preview`              | Lê, interpreta e devolve o que entraria. **Não grava nada.** |
| `POST /vault/imports`                      | Confirma as linhas escolhidas e registra o lote              |
| `GET /vault/imports`                       | Histórico de importações                                     |
| `GET/POST /vault/imports/profiles`         | Modelos de mapeamento                                        |
| `PATCH/DELETE /vault/imports/profiles/:id` | Editar e remover modelo                                      |

Limite de 1 MB por arquivo (o do body-parser da API). É folgado: um extrato
mensal em CSV tem ~15 KB e em OFX ~50 KB. A mensagem de erro sugere importar
por período quando alguém tenta o ano inteiro de uma vez.

## Classificação automática e regras (fase 4)

**Nenhuma IA participa disto**, por decisão explícita. Classificação alimenta
relatório e, na fase 7, despesa da empresa — um palpite errado não gera erro,
gera um número plausível. Regra determinística erra sempre do mesmo jeito, e
você conserta uma vez.

### A cascata

| #   | Nível            | O que é                                                               |
| --- | ---------------- | --------------------------------------------------------------------- |
| 1   | `EXTERNAL_ID`    | O mesmo FITID já classificado antes — reimportar não recomeça do zero |
| 2   | `RULE`           | A primeira regra sua que casar, por prioridade                        |
| 3   | `MERCHANT_ALIAS` | `ANTHROPIC` → Claude → categoria padrão do Claude                     |
| 4   | `SUBSCRIPTION`   | Fase 5; hoje chega sempre null                                        |
| 5   | `RECURRENCE`     | A mesma descrição já classificada por você, sempre igual              |
| 6   | revisão manual   | Nada resolveu — a movimentação fica `PENDING`                         |

### Preenchimento de lacunas, não "o primeiro decide tudo"

Cada nível preenche apenas os campos que os anteriores deixaram vazios, e nunca
sobrescreve um nível mais alto.

A alternativa seria mais simples e pior: uma regra do tipo "tudo neste cartão é
100% empresarial" não diz categoria nenhuma, e bloquearia o alias, deixando a
movimentação sem categoria. A regra tornaria o resultado **pior do que se ela
não existisse** — o oposto do que uma regra deve fazer.

`resolvedBy` guarda qual nível decidiu cada campo, e é o que permite a tela
explicar por que a movimentação ficou como ficou.

### Recorrência não é voto de maioria

Duas ocorrências iguais bastam para virar sugestão (uma só é coincidência). Mas
se a mesma descrição já foi para **duas categorias diferentes**, o resultado é
`null`, não a mais frequente: significa que ela realmente depende de contexto —
o mesmo `PAG*LOJA` pode ser trabalho ou lazer — e escolher a mais comum
classificaria errado com ar de certeza.

Só o que você já **confirmou** conta como histórico. Incluir linhas pendentes
faria uma classificação automática confirmar a si mesma na rodada seguinte.

### Ordem de regras é explícita

`priority` menor roda primeiro, e o desempate é pelo id. Isso não é detalhe: a
regra específica (`IFOOD ESTACIONAMENTO` → Transporte) precisa ser avaliada
antes da genérica (`IFOOD` → Delivery), e isso não tem relação nenhuma com qual
você criou primeiro. Sem o desempate, duas regras de mesma prioridade poderiam
alternar entre execuções e a mesma movimentação cairia em categorias diferentes
em duas rodadas.

### Duas regras que o service recusa

- **Regra sem condição** casaria com toda movimentação do Cofre e o
  reclassificaria inteiro. O matcher também recusa, de forma redundante — o
  custo de uma escapar é alto demais.
- **Regra sem ação** (nem categoria, nem fornecedor, nem percentual) é pior que
  não existir: ocupa uma prioridade e tira a movimentação da revisão sem
  classificar nada.

Editar valida o **resultado da mesclagem**, não só o patch — desligar a única
condição de uma regra a transformaria numa regra vazia.

### Percentual empresarial vira divisão

`businessPercent` é materializado como uma divisão `BUSINESS` do valor
proporcional. Percentual, e não valor absoluto, porque o valor muda a cada
cobrança (câmbio, plano) e a proporção não.

**A classificação automática não toca em divisões que você já fez.** Rateio
manual é decisão sua, e sobrescrevê-lo apagaria trabalho em silêncio. A
correção manual sobrescreve — aí quem pediu foi você.

0% não cria divisão de valor zero: é a ausência de divisão.

### Corrigir esta / criar regra para as próximas

A correção manual aceita `createRule`, e criar a regra **não reclassifica o
passado**. "Para as próximas" é literal: mexer retroativamente em lançamentos
que você já revisou desfaria decisões suas sem pedir.

`scopeToOrigin` amarra a regra à conta ou ao cartão daquela movimentação.

### O que a classificação faz com o status

Classificada (com categoria) → `CONFIRMED`. Sem categoria → continua `PENDING`,
esperando sua revisão. É a categoria, e não o fornecedor, que decide: sem ela a
movimentação não entra em relatório nenhum.

A importação dispara uma passada no que acabou de gravar, por uma porta
estreita (`TransactionClassifier`) e em modo best-effort — a importação já
aconteceu, e uma falha na classificação não pode desfazê-la; as linhas ficam
`PENDING` e uma nova passada resolve.

### API

| Rota                                           | O que faz                             |
| ---------------------------------------------- | ------------------------------------- |
| `GET/POST /vault/rules`                        | Listar e criar regras                 |
| `PATCH/DELETE /vault/rules/:id`                | Editar e remover                      |
| `POST /vault/classification/run`               | Passar a cascata nas pendentes        |
| `PATCH /vault/transactions/:id/classification` | Corrigir, opcionalmente criando regra |

## Assinaturas e alertas (fase 5)

### Primeiro, um vazamento fechado

`PushSender` só tinha `sendToOrg` — que alcança **todos** os dispositivos
inscritos na organização. Certo para "briefing concluído"; errado para "Claude
renova amanhã — R$120". A porta ganhou `sendToUser`, e o Cofre só usa essa. Um
alerta financeiro pessoal no navegador da equipe seria exatamente o vazamento
que o módulo inteiro existe para impedir, por uma porta que ninguém está
olhando.

### Entrega sem depender do worker

O ambiente é gratuito e o processo dorme. A verificação tem dois níveis, e o
**primeiro é o que garante**:

1. `refresh()` roda a cada abertura do app e do Cofre, recalcula tudo do zero e
   grava o que falta.
2. Push é a segunda camada, best-effort. Se o worker estiver dormindo, você vê
   os alertas na central do mesmo jeito.

Como a verificação roda a toda abertura, a idempotência deixa de ser detalhe de
implementação e passa a ser o que impede a tela de encher de repetição. Quem
garante é o `dedupeKey` (`tipo:âncora:data`), com unique no banco: rodar duas
vezes no mesmo dia produz exatamente as mesmas chaves e a segunda passada grava
zero.

### Uma cobrança nunca vira assinatura

Assinatura é uma afirmação sobre o futuro — "isso vai ser cobrado de novo" — e
afirmar isso com uma ocorrência só é adivinhação. A partir de duas cobranças
compatíveis vira **sugestão** (`POSSIBLE_NEW_SUBSCRIPTION`), nunca cadastro
automático: uma assinatura criada sozinha começaria a gerar alertas que você
não pediu, com valor e data que ninguém conferiu.

Detecção: intervalos ~30 dias (janela de 6) → mensal; ~365 (janela de 20) →
anual; intervalos consistentes entre si → personalizado. Valores fora da
tolerância, ou intervalos irregulares, não viram nada — compra recorrente no
mesmo lugar não é assinatura.

O **valor esperado é o da cobrança mais recente**, não a média: é o preço que
vale hoje. Uma média puxaria o esperado para baixo depois de um reajuste e
geraria alerta de variação na cobrança seguinte, que estaria certa.

### Os oito alertas

| Tipo                                                    | Quando                                                |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `RENEWS_TODAY` / `TOMORROW` / `IN_3_DAYS` / `IN_7_DAYS` | Marcos de antecedência, respeitando `alertDaysBefore` |
| `PRICE_CHANGED`                                         | Cobrança fora da tolerância — **nos dois sentidos**   |
| `POSSIBLE_DUPLICATE`                                    | Duas ativas do mesmo fornecedor com valor parecido    |
| `MISSING_CHARGE`                                        | Renovação passou e nada apareceu                      |
| `POSSIBLE_NEW_SUBSCRIPTION`                             | Recorrência detectada sem assinatura cadastrada       |

Detalhes que evitam alerta ruim:

- **Assinatura pausada ou cancelada não gera nada.** Você pausou justamente
  para parar de ser lembrado.
- **`MISSING_CHARGE` tem 3 dias de folga.** Banco atrasa; acusar no dia
  seguinte geraria falso positivo toda vez, e alerta que erra é alerta que você
  para de ler.
- **Duplicata gera um alerta por PAR**, não um por assinatura, e no máximo um
  por mês. Dois avisos dizendo a mesma coisa dobrariam o contador sem
  informação nova.
- **Variação de preço alerta na queda também.** Queda grande costuma ser
  mudança de plano ou cobrança parcial, e vale saber tanto quanto um aumento.
- **Tolerância padrão de 10%.** Assinatura em dólar oscila com o câmbio todo
  mês; tolerância zero geraria alerta em toda cobrança.

### Renovação calculada da última cobrança

Sempre a partir da cobrança que **realmente aconteceu**, não iterando de uma
data ideal. Uma assinatura cobrada em 31/01 cai em 28/02, e a próxima sai de
28/02 — não volta para o dia 31. É deliberado: a data que importa é a que o
banco cobrou.

**Extrato antigo não empurra a renovação para trás.** Importar meses passados
não pode reescrever a próxima renovação com uma data que já passou.

Mudar a periodicidade recalcula a próxima renovação — senão o alerta
continuaria no ritmo antigo e chegaria no dia errado sem nada denunciando.

### O nível 4 da cascata deixou de ser `null`

A classificação agora resolve a assinatura pelo fornecedor, e a regra ganhou
`setSubscriptionId` (a coluna aditiva prometida na fase 4). O exemplo do Claude
fecha: cobrança `ANTHROPIC` → fornecedor Claude → Trabalho/IA → assinatura
Claude → última cobrança registrada → próxima renovação calculada → "Claude
renova amanhã — valor esperado R$120".

O elo com a assinatura **empresarial** (`CostSubscription`) existe como
`costSubscriptionId`, **sem FK**: `cost_subscriptions` pertence à organização e
este modelo pertence ao Cofre — uma FK entre os dois mundos daria ao banco um
caminho de leitura que a aplicação inteira existe para impedir. O elo é
resolvido na fase 7, com verificação de posse dos dois lados.

### Central de alertas

`PENDING` e `SNOOZED` com prazo vencido aparecem; lidos somem. **Adiar tem
prazo** — adiar sem data seria esconder para sempre, que não é o que a palavra
promete.

### API

| Rota                                        | O que faz                                       |
| ------------------------------------------- | ----------------------------------------------- |
| `GET/POST /vault/subscriptions`             | Listar e criar                                  |
| `GET/PATCH/DELETE /vault/subscriptions/:id` | Detalhe, editar, remover                        |
| `POST /vault/alerts/refresh`                | Verificação completa — é o que a abertura chama |
| `GET /vault/alerts`                         | Central de alertas                              |
| `GET /vault/alerts/count`                   | Badge                                           |
| `PATCH /vault/alerts/:id/read`              | Marcar como lido                                |
| `PATCH /vault/alerts/:id/snooze`            | Adiar até uma data                              |

## Dívidas (fase 6)

Quem me deve, para quem eu devo, e o que já foi devolvido. Três tabelas —
`personal_contacts`, `personal_debts`, `personal_debt_payments` — e uma regra
que organiza todas as decisões abaixo.

### A regra: baixa de dívida não é fato econômico novo

**Um Pix recebido para quitar uma dívida não é renda.** O dinheiro entra na
conta, mas o fato já aconteceu antes — quando a compra foi feita e virou
dívida. Contar de novo na baixa seria contagem dupla: o mês em que alguém te
devolve R$500 apareceria como um mês em que você ganhou R$500 a mais.

O mesmo vale do outro lado: **pagar uma dívida que eu devo não é despesa
nova**. A despesa foi o empréstimo que entrou, não a devolução que sai.

Quem decide isso é `classifyCashFlow`, uma função só com quatro respostas
mutuamente exclusivas: `INCOME`, `EXPENSE`, `TRANSFER`, `DEBT_SETTLEMENT`.
Escrever `contaComoReceita()` e `contaComoDespesa()` separados criaria dois
lugares para manter a mesma regra, e a primeira divergência entre eles seria
silenciosa — os totais simplesmente parariam de fechar, sem erro nenhum.

O que sustenta a regra no banco é `personal_debt_payments.transaction_id`, com
**UNIQUE**: uma movimentação baixa no máximo uma dívida. Sem a unicidade, a
mesma entrada de R$200 poderia baixar duas dívidas de R$200 e o Cofre teria
inventado dinheiro.

### Valor pago, saldo e status não são colunas

A API expõe os três; nenhum é persistido. Todos saem das baixas mais a data de
hoje.

O argumento decisivo é o vencimento: uma dívida vira **atrasada pela passagem
do tempo**, sem que ninguém escreva nada. Uma coluna `status` estaria errada
toda madrugada e só voltaria a ficar certa quando alguém mexesse na linha — ou
seja, mentiria exatamente nas dívidas esquecidas, que são as que mais importam.

Pelo mesmo motivo o **cancelamento é coluna**: cancelar é um evento, a única
coisa aqui que só acontece porque alguém decidiu.

A ordem de `resolveDebtStatus` também é uma decisão: cancelada vence tudo (uma
dívida perdoada não fica atrasada para sempre na tela) e quitada vence atrasada
(pagou fora do prazo continua sendo pagou).

### O que o Postgres defende, e o que ele não consegue

No banco: `original_amount > 0`, `amount > 0` nas baixas, e as FKs.

Fora do banco, com teste: **a soma das baixas não pode ultrapassar o valor da
dívida.** É uma invariante entre linhas de tabelas diferentes, e um CHECK só
enxerga a própria linha. O gatilho que resolveria isso seria uma regra de
negócio escondida no banco, longe dos testes — então ela mora em
`validatePayment`.

Duas consequências desenhadas junto:

- Devolver a mais **não** vira crédito na direção oposta. O saldo trava em
  zero e o excedente aparece como `overpaid`, para ser resolvido à mão.
- Reduzir o valor da dívida abaixo do que já foi baixado é **recusado**, não
  "corrigido" sozinho: aceitar criaria saldo negativo e inverteria a dívida em
  silêncio.

### Quatro perguntas antes de vincular uma baixa

Cada uma existe por um jeito diferente de o número ficar errado:

| Pergunta                | O que ela evita                                                      |
| ----------------------- | -------------------------------------------------------------------- |
| É do Cofre?             | Filtrar por `vaultId` é o que garante isso, não a suposição.         |
| Direção certa?          | Trocada, a baixa esconderia uma despesa como se fosse receita.       |
| Não é transferência?    | Uma conta sua não te deve dinheiro.                                  |
| Ainda não baixou outra? | O UNIQUE recusaria, mas com erro de constraint em vez de explicação. |

### A compra reembolsável fecha o ciclo

Criar uma dívida a receber a partir de uma compra também marca a divisão
`REIMBURSABLE` naquela movimentação, na mesma operação. Sem isso os R$300 do
jantar continuariam contados como gasto seu enquanto a tela de dívidas jurasse
que alguém te deve R$100.

O rateio que já existia é **preservado**: o repositório só sabe substituir o
conjunto inteiro (rateio pela metade é rateio errado), então o serviço lê antes
e reenvia tudo. Sem esse cuidado, criar uma dívida apagaria em silêncio a
divisão empresarial já lançada naquela compra. Se o total não couber no valor
da movimentação, a dívida **não é criada** — recusar depois de gravar deixaria
um valor a receber sem o reembolsável correspondente.

### A lição da fase 5, aplicada antes de doer

A FK da baixa é `ON DELETE RESTRICT`. Um erro de constraint sobe como 500 — foi
exatamente assim que a exclusão de conta quebrou na fase anterior, e só apareceu
executando o app.

Desta vez a checagem veio antes: apagar uma movimentação que baixa dívida
responde **409** dizendo qual dívida está no caminho, e apagar uma pessoa com
dívida responde **409** sugerindo desativar em vez de apagar. Quem pergunta é a
porta `DebtLinkChecker` — uma pergunta só, e não o serviço de dívidas inteiro
injetado no de movimentações.

### Privacidade

`personal_contacts` guarda nome, um campo de contato em texto livre e
observações. **Não existe coluna de CPF, conta bancária ou chave Pix**, e isso
é deliberado: o Cofre não guarda credencial de ninguém — nem do dono, nem de
terceiro. Um dado de terceiro vazado é pior que um dado próprio vazado, porque
a pessoa nem sabia que ele estava aqui.

### API

| Rota                                    | O que faz                                             |
| --------------------------------------- | ----------------------------------------------------- |
| `GET/POST/PATCH/DELETE /vault/contacts` | Pessoas. Apagar com dívida → 409.                     |
| `GET /vault/debts`                      | Em aberto por padrão; filtros de direção/pessoa.      |
| `GET /vault/debts/summary`              | A receber, a pagar e quantas atrasadas de cada.       |
| `POST /vault/debts`                     | Cria; `markOriginReimbursable` fecha o ciclo.         |
| `PATCH /vault/debts/:id`                | Descrição, valor, vencimento, cancelar/reabrir.       |
| `POST /vault/debts/:id/payments`        | Baixa total ou parcial.                               |
| `DELETE /vault/debts/:id/payments/:id`  | Desfaz a baixa e devolve a dívida ao estado anterior. |

Telas: `/cofre/dividas` e `/cofre/pessoas`.

## Ponte com o financeiro da MilWeb (fase 7)

Uma compra pessoal pode ter uma parte que é da empresa — o Claude que você paga
no cartão pessoal e usa pra trabalhar. Essa parte precisa aparecer no custo da
MilWeb **sem que o financeiro da empresa enxergue o resto da sua vida**.

### O que atravessa, e o que não

Atravessa: valor, data, categoria, o plano que aquilo realiza (opcional) e **a
descrição que você escreve**. A descrição ser obrigatória é uma decisão: a
alternativa seria copiar `originalDescription`, e aí a linha crua do banco
apareceria no financeiro da empresa sem ninguém ter decidido isso.

Não atravessa: o id da movimentação, a conta, o cartão, a fatura e as outras
divisões daquela compra.

A `BusinessExpense` **não tem nenhuma coluna apontando pro Cofre**. Quem guarda
o elo é a `PersonalBusinessAllocation`, e só o Cofre a lê. Alguém com permissão
no financeiro vê "Claude Pro — R$120 — 05/08 — origem: Cofre pessoal" e não
chega a mais nada. Saber que a despesa saiu do bolso do dono é um fato contábil
legítimo (a empresa deve isso a ele); saber o que mais tinha naquela fatura não
é.

### Vai só a parte da empresa

O valor enviado é a **soma das divisões BUSINESS**, nunca o valor da compra.
Mandar os R$300 do jantar quando só R$100 é da MilWeb cobraria da empresa um
dinheiro que ela não deve — e o número seria plausível o bastante pra passar
despercebido no fechamento do mês.

### Planejado x realizado nunca somam

`CostSubscription` é o **plano** ("o Claude custa US$20/mês"), e é ele que entra
em `computeSummary`. `BusinessExpense` é o **realizado** ("no dia 05/08 saíram
R$120"). Os dois descrevem o mesmo Claude: somar daria R$230/mês, o custo da
agência dobraria da noite pro dia, e o número errado seria plausível demais pra
alguém desconfiar.

Por isso:

- A despesa realizada **não entra** em `computeSummary` — o resumo de custos
  continua sendo uma previsão.
- `summarizeExpenses` devolve `planejadoBrl` e `realizadoBrl` separados, mais
  `diferencaBrl`, que é **subtração** (positivo = estourou). Nenhuma função
  devolve a soma dos dois, e há teste varrendo os campos do resumo pra garantir
  que nenhum deles é essa soma.
- Na tela, os dois vivem em blocos separados, um rotulado "previsto" e o outro
  "realizado".

### Enviar duas vezes não dobra nada

O elo tem **UNIQUE na movimentação** — não na divisão. As divisões são
substituídas em bloco: corrigir o rateio troca o id da divisão empresarial, e
uma chave baseada nela deixaria a mesma compra ser enviada de novo.

Um segundo envio é recusado com 409. Se o rateio mudou depois, os caminhos são
**sincronizar** (atualiza o valor lá) ou **desfazer** — nunca somar um segundo
lançamento.

E a correção não é automática: quando o rateio diverge do que foi enviado, a
compra aparece como **desatualizada**, com os dois números à vista. Reescrever a
contabilidade da empresa sem ninguém pedir é pior que mostrar a diferença — o
mês pode já ter fechado com o número antigo, e quem fechou precisa saber.

### O único pedaço do Cofre com RBAC

O Cofre não tem `requirePermission` em lugar nenhum: seus dados não são da
organização, e a autorização é posse do Cofre mais sessão elevada.

Mas **escrever no financeiro da empresa é escrever dado da organização**. Sem
checar permissão ali, a ponte seria um caminho para contornar o RBAC do módulo
de custos — quem não pode lançar custo pelo Centro de Custos lançaria pelo
Cofre.

Por isso as rotas da ponte vivem num router separado (`vault-bridge-routes.ts`)
com três camadas somadas: `authenticate` · `requireVault` · `requirePermission`.
Ficam fora de `vault-data-routes.ts` de propósito — lá a invariante "nenhuma
rota tem RBAC" é testada, e misturar as duas transformaria o teste numa lista de
exceções que cresce sem ninguém notar.

A permissão usada é a mesma do módulo de custos (`proposals:read/write`), não
uma chave nova: chave nova entraria automaticamente em `ADMIN_PERMISSIONS` e
daria a todo Admin de toda organização um poder que ninguém decidiu conceder.

### Sempre em reais

Despesa vinda do Cofre é sempre BRL. O Cofre já sabe o que de fato saiu da conta
em reais, com IOF e spread do dia; reconverter pela cotação de hoje reescreveria
o passado a cada oscilação do dólar — o mesmo motivo pelo qual `unitPriceBrl` é
congelado no `CostUsageEntry`.

### Quem manda no valor

O valor de uma despesa vinda do Cofre **não é editável pelo financeiro**. Ele é
governado pelo rateio da compra; editar lá criaria duas versões da mesma verdade
e a próxima sincronização desfaria a edição sem avisar. Descrição, categoria e
plano continuam editáveis.

Apagar pelo financeiro, ao contrário, **é permitido** e desfaz o envio: o elo cai
por Cascade e a compra volta a aparecer como "não enviada" no Cofre, que é a
verdade. Recusar com 409 apontando pra um Cofre que quem está no financeiro nem
pode ver seria um erro impossível de resolver de onde a pessoa está.

### Uma lacuna da fase 5, fechada

`personal_subscriptions.cost_subscription_id` era aceito sem conferir nada — um
id de outra organização passava batido. Não há FK entre os dois mundos que faça
isso (de propósito: uma chave estrangeira obrigaria o banco a conhecer os dois
donos ao mesmo tempo), então a verificação virou uma porta,
`CostSubscriptionVerifier`, usada tanto pela assinatura pessoal quanto pela
despesa.

### API

| Rota                                        | O que faz                                         |
| ------------------------------------------- | ------------------------------------------------- |
| `GET /vault/business/allocations`           | Compras com parte empresarial e o estado de cada. |
| `GET /vault/business/plans`                 | Planos de custo da organização, pro seletor.      |
| `POST /vault/business/allocations/:id`      | Envia a parte da empresa.                         |
| `POST /vault/business/allocations/:id/sync` | Alinha o valor lá com o rateio de cá.             |
| `DELETE /vault/business/allocations/:id`    | Desfaz o envio.                                   |
| `GET/POST/PATCH/DELETE /costs/expenses`     | Despesas realizadas (lado empresarial).           |
| `GET /costs/expenses/summary`               | Previsto x realizado do período.                  |

Telas: `/cofre/milweb` e a seção "Realizado no mês" em `/costs`.

## Telas (antecipadas da fase 8)

Dez telas sob `/cofre`, puxadas para antes das fases 6, 7 e 9 — cinco fases de
API sem nada visível já era tempo demais.

| Rota                                        | O que faz                                              |
| ------------------------------------------- | ------------------------------------------------------ |
| `/cofre`                                    | Visão geral: o que exige ação primeiro, números depois |
| `/cofre/movimentacoes`                      | Lista com filtros, revisão e correção                  |
| `/cofre/importar`                           | Upload, mapeamento, pré-visualização, confirmação      |
| `/cofre/assinaturas`                        | Cadastro, pausar, cancelar                             |
| `/cofre/alertas`                            | Central, com marcar como lido e adiar                  |
| `/cofre/contas` · `/cofre/cartoes`          | Cadastros e faturas                                    |
| `/cofre/categorias` · `/cofre/fornecedores` | Catálogo e aliases                                     |
| `/cofre/regras`                             | Regras de classificação                                |

### A porta mora no layout, não nas páginas

`cofre/layout.tsx` decide se mostra a tela bloqueada ou o conteúdo. Uma página
nova nasce protegida sem ninguém lembrar de nada, e o conteúdo do Cofre **nunca
chega a ser montado** enquanto ele está fechado — não é uma tela escondida por
cima, é uma tela que não existe.

É também no layout que a verificação de alertas roda ao abrir. É o primeiro
nível de entrega: no plano gratuito o worker dorme, então esta tela é a
garantia e o push é a segunda camada.

### Duas correções que a UI exigiu

**Data em UTC.** O `formatDate` genérico do app converte para o fuso local. As
colunas do Cofre são `@db.Date` e chegam como meia-noite UTC, então em UTC-3
**todo lançamento apareceria um dia antes**. O Cofre tem
`formatVaultDate`, com `timeZone: "UTC"` fixo — a data não tem hora, não há o
que converter.

**Codificação do extrato.** Banco brasileiro exporta CSV em ISO-8859-1 com
frequência incômoda. Lido como UTF-8, todo acento vira `�` — e o estrago não é
visual: a descrição entra no fingerprint de deduplicação, então
`MERCADINHO S�O JO�O` e `MERCADINHO SAO JOAO` seriam movimentações diferentes e
a reimportação duplicaria tudo. `decodeBankFile` tenta UTF-8 estrito e cai para
Windows-1252 quando o decodificador reclama.

### Um bug que só a execução encontrou

Apagar uma conta que já tinha sido usada numa importação respondia **500**, não
o 409 previsto.

A causa era uma incompatibilidade entre duas decisões boas: o lote de
importação tem um CHECK de **origem única** (conta XOR cartão), e as FKs de
origem eram `ON DELETE SET NULL`. Ao apagar a conta, o Postgres zerava
`account_id` — e com as duas colunas nulas o lote violava a própria
constraint. Nenhum teste unitário pegaria isso: é a interação de duas regras de
banco, e só aparece executando a exclusão de verdade.

A correção é `ON DELETE CASCADE` nas duas FKs, que também é o significado
certo: um lote descreve uma importação **para** uma origem, e sem ela não
descreve nada. Quando a origem pode ser apagada, as movimentações dela já
foram embora — a FK delas é `Restrict`.

### Decisões de interface

- **A visão geral começa pelo que exige ação** (alertas, movimentações a
  revisar, faturas abertas) e só depois mostra saldo. Um painel que começa por
  saldo é bonito e inútil: o saldo você já sabe.
- **O regime (competência × caixa) fica visível o tempo todo**, não escondido
  num menu. São dois números diferentes para a mesma pergunta, e uma tela que
  não diz qual está mostrando engana.
- **Transferências ficam escondidas por padrão** na lista — elas movem dinheiro
  entre seus bolsos, não são gasto.
- **"Criar regra para as próximas" diz na tela que não mexe no passado.** A
  promessa precisa ser literal na interface, senão a pessoa espera que os
  lançamentos antigos mudem.
- **A tela bloqueada não mostra nada financeiro**, nem como esqueleto de
  carregamento.
- **Fechar o Cofre limpa o cache** do React Query inteiro (`["vault"]`) —
  nenhum dado sobrevive ao bloqueio.
- **A pré-visualização é mutation, não query.** Como query, o React Query
  guardaria o conteúdo do extrato em cache, que é exatamente o que este módulo
  evita.

## Configuração

```bash
# obrigatório pro módulo existir; sem ele todas as rotas respondem 404
VAULT_SESSION_SECRET="cole-aqui-48-bytes-aleatorios"   # 32+ chars, != JWT_ACCESS_SECRET
VAULT_SESSION_TTL="15m"                                 # inatividade tolerada
```

Gere o segredo com `openssl rand -base64 48`.

## Testes

519 testes cobrem as sete fases e as telas, todos sem banco e sem HTTP real (exceto os
de rota, que sobem Express numa porta efêmera).

**Fase 1 — segurança:**

| Arquivo                             | O que prova                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault-lockout.test.ts`             | Escalonamento, saturação, expiração no instante exato.                                                                                        |
| `personal-vault-service.test.ts`    | 404 pra não-dono, idempotência, bcrypt não é gasto durante bloqueio, auditoria sem organização e sem valores.                                 |
| `require-vault.test.ts`             | Sessão normal não substitui a elevada; token de outro usuário dá 404; "Bloquear agora" mata token já emitido; sem segredo o módulo some.      |
| `jwt-vault-session-service.test.ts` | Token do `JWT_ACCESS_SECRET` não abre o Cofre; escopo errado, expirado e `alg:none` recusados.                                                |
| `vault-routes.test.ts`              | **Usuário sem permissão nenhuma chega ao controller** — é o teste que cai se alguém "consertar" o módulo pondo `requirePermission` nas rotas. |

**Fase 2 — núcleo:**

| Arquivo                                | O que prova                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault-money.test.ts`                  | Soma em centavos é exata; três casas decimais são erro, não arredondamento.                                                                     |
| `vault-date.test.ts`                   | A data não desliza de dia; dia 31 encolhe em fevereiro (inclusive bissexto).                                                                    |
| `transaction-text.test.ts`             | Normalização idempotente; "08/2026" não vira "parcela 8 de 2026".                                                                               |
| `transaction-fingerprint.test.ts`      | FITID vence a descrição; mesmo FITID em contas diferentes não colide.                                                                           |
| `split-allocation.test.ts`             | Rateio não passa do valor nem por um centavo; gasto empresarial sai do consumo pessoal.                                                         |
| `statement-period.test.ts`             | Compra antes/depois do fechamento; virada de ano; vencimento anterior ao fechamento; fatura zerada não vira PAGA.                               |
| `default-categories.test.ts`           | Chaves de sistema únicas; pais antes das filhas.                                                                                                |
| `personal-transaction-service.test.ts` | **Pagamento de fatura não vira despesa nova**; estorno recalcula o total; transferência sai dos totais; moeda estrangeira exige o valor em BRL. |
| `vault-data-routes.test.ts`            | As 31 rotas de dados exigem sessão elevada, uma a uma — mais um teste que falha se alguém registrar rota nova fora da lista.                    |

**Fase 3 — importação:**

| Arquivo                           | O que prova                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `import-amount.test.ts`           | `1.234,56`, `(50,00)`, `50,00-`; recusa separador ambíguo, três casas e valor zero.                                                    |
| `import-date.test.ts`             | `08/07` é julho ou agosto conforme o perfil; **não desliza de dia por fuso**; 29/02 só em ano bissexto.                                |
| `import-csv.test.ts`              | Aspas, aspas duplicadas, quebra de linha no campo, CRLF, BOM; separador escolhido por consistência de colunas, não por contagem.       |
| `import-ofx.test.ts`              | OFX 1.x (SGML sem fechamento) e 2.x (XML); HTML não vira OFX; extrato sem movimentação é válido e vazio.                               |
| `import-mapper.test.ts`           | Mapeamento por nome e por índice; débito/crédito em colunas separadas; `invertSign`; **erro nunca carrega conteúdo do extrato**.       |
| `import-dedup.test.ts`            | Duplicata no arquivo × no Cofre; FITID repetido pega mesmo com descrição e valor mudados; reimportação classifica tudo como duplicata. |
| `personal-import-service.test.ts` | Pré-visualização **não grava nada**; reimportar não duplica; nome de arquivo higienizado; mês sem movimentação é vazio, não erro.      |

**Fase 4 — classificação:**

| Arquivo                                   | O que prova                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `classification-rule-match.test.ts`       | CONTAINS/STARTS_WITH/EXACT; condições combinam com E; faixa inclusiva; **regra vazia não casa com tudo**; ordem estável no empate.         |
| `classification-cascade.test.ts`          | Os 5 níveis na ordem certa; preenchimento de lacunas sem sobrescrever; **recorrência não vira voto de maioria**; exemplo do Claude.        |
| `personal-classification-service.test.ts` | Recusa regra sem condição e sem ação; **automático não sobrescreve divisão manual**; correção não mexe no passado; sem regra fica PENDING. |

**Fase 5 — assinaturas e alertas:**

| Arquivo                                 | O que prova                                                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `subscription-schedule.test.ts`         | Mensal/anual/personalizado; dia 31 encolhe no mês curto; 29/02 anual cai em 28/02; CUSTOM sem intervalo é erro.                                  |
| `subscription-detection.test.ts`        | **Uma cobrança nunca vira assinatura**; valor esperado é o mais recente, não a média; intervalos irregulares não viram nada.                     |
| `subscription-alerts.test.ts`           | Os 4 marcos + antecedência; pausada não alerta; folga antes de acusar cobrança faltando; duplicata é um alerta por par; chaves estáveis.         |
| `personal-subscription-service.test.ts` | Exemplo do Claude ponta a ponta; **rodar duas vezes não duplica**; extrato antigo não empurra renovação; push só pro dono; adiar volta no prazo. |

**Fase 6 — dívidas:**

| Arquivo                         | O que prova                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `debt-status.test.ts`           | **Atrasa sozinha com a passagem do tempo**; cancelada vence tudo; pagou fora do prazo é pago; saldo nunca negativo; um centavo a mais é recusado.                         |
| `cash-flow-kind.test.ts`        | **Pix que quita não é renda**; pagar dívida não é despesa nova; transferência continua fora; ordem não decide nada.                                                       |
| `personal-debt-service.test.ts` | As duas direções; parcial e total; atraso no resumo; a mesma movimentação não baixa duas dívidas; **reembolsável tira do consumo pessoal** e preserva o rateio existente. |

**Fase 7 - ponte com o financeiro:**

| Arquivo                            | O que prova                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expense-summary.test.ts`          | **Nenhum campo do resumo e planejado + realizado**; criar despesa nao mexe no custo previsto; plano sem cobranca aparece com zero; dolar convertido.    |
| `personal-bridge-service.test.ts`  | Vai **so a parte da empresa**; descricao e a que a pessoa escreveu; a despesa nao leva de volta ao Cofre; segundo envio e 409; sincronizar nao duplica. |
| `business-expense-service.test.ts` | Valor de despesa do Cofre nao e editavel pelo financeiro; apagar de la desfaz o envio; plano de outra organizacao e recusado.                           |
| `vault-bridge-routes.test.ts`      | **A ponte nao e atalho pro RBAC**: sem permissao no financeiro e 403; sem Cofre aberto e 401; quem so le nao envia.                                     |

## Roadmap

| #   | Fase                                                                   | Estado |
| --- | ---------------------------------------------------------------------- | ------ |
| 1   | Cofre, sessão elevada, reautenticação                                  | ✓      |
| 2   | Contas, cartões, categorias, fornecedores, transações, splits, faturas | ✓      |
| 3   | Importação OFX/CSV e deduplicação                                      | ✓      |
| 4   | Classificação e regras determinísticas                                 | ✓      |
| 5   | Assinaturas e alertas                                                  | ✓      |
| 6   | Dívidas e pagamentos                                                   | ✓      |
| 7   | Ponte com o financeiro da MilWeb (`BusinessExpense`)                   | ✓      |
| 8   | Telas (antecipadas) · dashboard e drill-down completos                 | ◐      |
| 9   | Backup e exportação                                                    | ○      |
| 10  | Testes finais, documentação e revisão                                  | ○      |
