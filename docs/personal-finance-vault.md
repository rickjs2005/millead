# Cofre Financeiro

Área privada do MilLead para as finanças **pessoais** do dono da conta. Nasceu
de uma exigência simples e incomum no resto do sistema: nenhum membro da
equipe pode ver, consultar ou inferir o que está aqui — nem quem tem papel
Owner ou Admin na organização.

> **Estado atual: Fase 1 de 10.** A segurança está pronta e testada. Contas,
> cartões, movimentações, importação de OFX/CSV, classificação, assinaturas,
> dívidas, integração com o financeiro da MilWeb, dashboard e exportação são
> as fases seguintes — ver [Roadmap](#roadmap).

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

## Configuração

```bash
# obrigatório pro módulo existir; sem ele todas as rotas respondem 404
VAULT_SESSION_SECRET="cole-aqui-48-bytes-aleatorios"   # 32+ chars, != JWT_ACCESS_SECRET
VAULT_SESSION_TTL="15m"                                 # inatividade tolerada
```

Gere o segredo com `openssl rand -base64 48`.

## Testes

41 testes cobrem esta fase, todos sem banco e sem HTTP real (exceto os de
rota, que sobem Express numa porta efêmera):

| Arquivo                             | O que prova                                                                                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault-lockout.test.ts`             | Escalonamento, saturação, expiração no instante exato.                                                                                        |
| `personal-vault-service.test.ts`    | 404 pra não-dono, idempotência, bcrypt não é gasto durante bloqueio, auditoria sem organização e sem valores.                                 |
| `require-vault.test.ts`             | Sessão normal não substitui a elevada; token de outro usuário dá 404; "Bloquear agora" mata token já emitido; sem segredo o módulo some.      |
| `jwt-vault-session-service.test.ts` | Token do `JWT_ACCESS_SECRET` não abre o Cofre; escopo errado, expirado e `alg:none` recusados.                                                |
| `vault-routes.test.ts`              | **Usuário sem permissão nenhuma chega ao controller** — é o teste que cai se alguém "consertar" o módulo pondo `requirePermission` nas rotas. |

## Roadmap

| #   | Fase                                                                   | Estado |
| --- | ---------------------------------------------------------------------- | ------ |
| 1   | Cofre, sessão elevada, reautenticação                                  | ✓      |
| 2   | Contas, cartões, categorias, fornecedores, transações, splits, faturas | ○      |
| 3   | Importação OFX/CSV e deduplicação                                      | ○      |
| 4   | Classificação e regras determinísticas                                 | ○      |
| 5   | Assinaturas e alertas                                                  | ○      |
| 6   | Dívidas e pagamentos                                                   | ○      |
| 7   | Ponte com o financeiro da MilWeb (`BusinessExpense`)                   | ○      |
| 8   | Dashboard e drill-down                                                 | ○      |
| 9   | Backup e exportação                                                    | ○      |
| 10  | Testes finais, documentação e revisão                                  | ○      |
