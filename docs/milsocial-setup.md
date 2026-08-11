# MilSocial: Setup de Token Instagram e Sincronização Automática

MilSocial é a ferramenta interna do dono para sincronizar métricas do Instagram (@milweb) e gerar análise por IA sobre o desempenho por formato de post. Este guia cobre a configuração completa: conversão de conta, criação do app Meta, configuração de variáveis de ambiente, primeiro sync manual e automação via GitHub Actions (agendador diário, sem depender de n8n — o Rick não usa mais n8n).

## 1. Converter a Conta do Instagram para Profissional

Antes de qualquer integração, a conta @milweb precisa estar configurada como conta profissional de empresa.

1. Abra o app do Instagram na conta @milweb
2. Toque em **Configurações** (ícone de engrenagem no canto inferior direito)
3. Selecione **Conta**
4. Toque em **Mudar para conta profissional**
5. Escolha **Empresa** como tipo de conta (não criador)
6. Preencha os dados solicitados (nome da empresa, categoria, contato)
7. Confirme e aguarde até 24h para ativação completa

A conta agora aparecerá como profissional e todos os reels terão métricas disponíveis via API.

## 2. Criar o App na Meta e Gerar Token de Longa Duração

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Faça login com a conta Meta associada (pode ser diferente da @milweb)
3. Clique em **Meus Aplicativos** (canto superior esquerdo)
4. Clique em **Criar Aplicativo**
5. Selecione o tipo **Business** (não Consumer)
6. Preencha os dados do app (nome: "MilSocial", descrição: "Ferramenta de análise de reels")
7. Após criação, acesse o dashboard do app
8. No menu lateral, clique em **Casos de uso** (o console da Meta não usa mais "Adicionar Produto" pra isso)
9. No card **"Gerenciar mensagens e conteúdo no Instagram"**, clique em **Personalizar**
10. Siga o fluxo pra adicionar a conta @milweb como tester: em **Instagram Tester** (ou equivalente dentro do caso de uso), clique em **Adicionar pessoas**
11. Digite o username da conta @milweb e confirme
12. Abra o app do Instagram na conta @milweb, vá em Configurações > Apps e Sites > Aplicativos e sites, e aceite o convite de tester
13. Volte ao dashboard do Meta e aguarde a aceitação ser refletida (refresh a página)
14. Ainda dentro do caso de uso (não na ferramenta genérica "Explorador da Graph API" — ver aviso abaixo), gere o token com as permissões do fluxo "Instagram API with Instagram Login":
    - `instagram_business_basic`
    - `instagram_business_manage_insights`
15. Clique em **Gerar Token de Acesso** — este é o token long-lived (60 dias de validade)
16. Copie o token inteiro (string longa começando com `IGAA...` — versões mais antigas do fluxo geravam tokens `IGQVJheW...`, ambos os formatos são válidos)

**⚠️ Não use o "Explorador da Graph API"** (Ferramentas > Explorador da Graph API): essa ferramenta gera token pra `graph.facebook.com` (fluxo de Login do Facebook / Páginas), incompatível com o MilSocial, que chama `graph.instagram.com` direto. Um token gerado ali causa o erro `code 190` na hora de sincronizar (seção 6). O token certo só sai de dentro do caso de uso do Instagram (passo 9-15 acima).

**Nota:** Tokens long-lived do Instagram valem 60 dias. O MilSocial renova automaticamente e persiste o novo token no banco (`SocialConfig`), então não é necessário atualizar manualmente — **desde que o sync esteja rodando**.

**Como a renovação funciona de verdade** (importa se o cron parar): o refresh só acontece _dentro_ de um sync, e só quando faltam menos de 10 dias pra expirar. Ou seja, é preciso pelo menos um sync bem-sucedido dentro dos últimos 10 dias de vida do token. Se essa janela passar em branco, a Meta não aceita mais renovar — o token morre em definitivo e você refaz a seção 2 inteira. Por isso o cron agendado não é conveniência: é o que mantém o token vivo.

Pra conferir a validade atual, olhe `SocialConfig.tokenExpiresAt` no banco (`pnpm --filter @millead/database studio`).

## 3. Configurar Variáveis de Ambiente

Defina os seguintes valores nos ambientes local, Render (API) e Vercel (web):

### 3.1 Arquivo `.env.local` (desenvolvimento)

```bash
# Copie do .env.example:
cp .env.example .env.local
```

Edite o `.env.local` e descomente/preencha:

```env
# API (apps/api):
INSTAGRAM_ACCESS_TOKEN="IGQVJheW..." # Cole o token gerado na seção 2
MILSOCIAL_SYNC_KEY="gere-com-openssl-rand-hex-24" # Veja abaixo

# Web (apps/web):
NEXT_PUBLIC_OWNER_EMAIL="rick@milweb.com.br" # E-mail autorizado do dono
```

Para gerar a chave de sincronização:

```bash
openssl rand -hex 24
```

Copie a saída (será algo como `3a7f2b9c1e5d4a8f6c2b9e1d3a7f2b9c1e5d4a8f`) e cole em `MILSOCIAL_SYNC_KEY`.

### 3.2 Render (API)

1. Acesse [dashboard.render.com](https://dashboard.render.com)
2. Clique no serviço **millead-api**
3. Vá em **Variáveis de Ambiente**
4. Adicione:
   - `INSTAGRAM_ACCESS_TOKEN`: Cola o token de 60 dias (mesmo do .env.local)
   - `MILSOCIAL_SYNC_KEY`: Cola o valor gerado com openssl
   - `OWNER_EMAIL`: E-mail do dono (ou deixe em branco se já estiver — opcional)
5. Clique em **Salvar**
6. O serviço redeploy automaticamente

### 3.3 Vercel (Web)

1. Acesse [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecione o projeto **millead** (web)
3. Vá em **Configurações** > **Variáveis de Ambiente**
4. Adicione:
   - `NEXT_PUBLIC_OWNER_EMAIL`: Cole o e-mail do dono (mesmo da seção 3.2)
5. Clique em **Salvar**
6. Faça um novo deploy ou aguarde que o CI/CD capture a mudança

**Atenção:** Variáveis que começam com `NEXT_PUBLIC_` são expostas no bundle do cliente — use apenas para dados não-sensíveis (e-mail do owner, URLs públicas, IDs).

**Atenção — deploy pode não "pegar" sozinho:** depois de salvar a env e rodar um novo deploy, confirme com `vercel inspect millead.milweb.com.br` (CLI) que o domínio custom realmente aponta pro deployment novo — não confie só no "Success" do `vercel --prod`. Se o projeto já teve algum rollback manual no passado, o domínio pode ficar preso num deployment antigo mesmo com deploys novos passando (eles ficam com `target: production` mas não assumem o alias sozinhos). Nesse caso, promova explicitamente: `vercel promote <url-do-deployment-novo>`.

## 4. Primeiro Sync Manual e Teste

Após configurar os envs em desenvolvimento e fazer deploy para Render/Vercel:

1. Acesse [millead.milweb.com.br/admin/milsocial](https://millead.milweb.com.br/admin/milsocial) logado como o dono
2. Verifique que o e-mail na barra superior coincide com `NEXT_PUBLIC_OWNER_EMAIL`
3. Clique em **Sincronizar agora**
4. Aguarde a sincronização terminar (veja o aviso sobre a primeira carga logo abaixo — ela pode demorar bem mais que uma sync normal)
5. Depois de concluída, o painel mostra:
   - Uma tabela de **comparação por formato** (reach, views, tempo médio assistido e interações, agrupados por formato de post)
   - Um **gráfico temporal** de alcance/views ao longo do tempo
   - Uma **lista de posts**, cada um com um badge de formato que pode ser corrigido manualmente (útil quando a classificação por IA erra)

Se tudo aparecer, o token foi renovado e armazenado no banco. A partir daqui, o workflow do GitHub Actions (seção 5) pode sincronizar automaticamente sem intervenção manual.

**Atenção — primeira carga histórica:** a primeira sincronização pagina todos os posts existentes do Instagram e busca insights de cada um; para contas com muito conteúdo isso pode levar minutos (bem mais que os ~30s de uma sync incremental do dia a dia). Prefira disparar a primeira sync pelo workflow do GitHub Actions (seção 5.2, que já roda com timeout/retry) em vez do botão do painel — o proxy do painel pode dar timeout antes da API terminar em background. Se isso acontecer, não é um erro real: o sync continua rodando no servidor e é idempotente (upsert por `igMediaId` e snapshot por dia), então basta aguardar e clicar em **Sincronizar agora** de novo mais tarde para confirmar que os dados chegaram.

**Aviso:** Se o painel avisa que o token expirou após alguns dias de inatividade, repita a seção 2 (gerar novo token) e atualize `INSTAGRAM_ACCESS_TOKEN` no Render. O ciclo de 60 dias reinicia.

## 5. Automação com GitHub Actions

Sem n8n, o jeito mais simples de disparar o sync diário sem pagar por nenhum serviço novo é um workflow agendado direto no repositório `millead` no GitHub — ele já existe, já tem CI, e o agendador roda de graça.

### 5.1 Criar o secret com a chave de sincronização

1. No GitHub, abra o repositório `rickjs2005/millead`
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret**
4. Nome: `MILSOCIAL_SYNC_KEY` — Valor: cole o mesmo valor exato configurado em `MILSOCIAL_SYNC_KEY` no Render (seção 3.2)
5. **Add secret**

### 5.2 O workflow

O arquivo `.github/workflows/milsocial-sync.yml` já existe no repositório e o GitHub agenda sozinho a partir do `cron` — não precisa criar nada. Ele roda quatro passos, nesta ordem:

1. **Conferir se o secret existe** — falha imediatamente com mensagem clara se `MILSOCIAL_SYNC_KEY` estiver ausente ou vazio, em vez de deixar o erro virar um 401 ambíguo lá na frente (ver seção 6)
2. **Acordar a API** — o free tier do Render dorme e leva ~60s pra subir; sem isso o cold start comia quase todo o tempo do sync
3. **Disparar o sync** — com `--fail-with-body` (imprime o corpo do erro) e `--max-time 600` (a primeira carga histórica é lenta)
4. **Validar o resultado** — falha se a API responder 200 sem ter visto nenhum post nem gravado nenhum snapshot, e emite aviso se houver posts sem métrica nova

O passo 4 existe porque um sync pode responder `200 OK` sem ter feito absolutamente nada — token vivo, mas todas as chamadas de insights falhando. Sem essa checagem, isso passaria por sucesso.

### 5.3 Testar manualmente

1. No GitHub, aba **Actions** do repositório
2. Selecione o workflow **MilSocial daily sync** na lista à esquerda
3. Botão **Run workflow** (usa o gatilho `workflow_dispatch`) → **Run workflow**
4. Acompanhe o log da execução — sucesso é `HTTP 200` do curl; qualquer erro aparece no próprio log, incluindo o corpo da resposta da API

A partir daí, o workflow dispara sozinho todo dia às 05:00 (horário de Brasília) e sincroniza os reels sem qualquer ação manual. Não exige conta em nenhum serviço externo — só o GitHub que o Rick já usa pra tudo.

**Alternativa sem GitHub Actions:** se preferir não usar Actions, [cron-job.org](https://cron-job.org) é um serviço externo gratuito que faz o mesmo (agenda uma chamada HTTP diária com header customizado) sem precisar de repositório — cadastro simples, cria o job apontando pra mesma URL e header `X-Sync-Key`.

## 6. Solução de Problemas

### Erro 503 ao clicar em "Sincronizar Agora"

**Causa:** Token não configurado ou chave `INSTAGRAM_ACCESS_TOKEN` vazia no Render.  
**Solução:** Verifique `INSTAGRAM_ACCESS_TOKEN` no Render, confirme que não está vazia, redeploy manual (`git push` ou botão de deploy no dashboard Render).

### Erro "Instagram Graph API: Invalid OAuth access token — Cannot parse access token (code 190)"

**Causa:** O valor salvo em `INSTAGRAM_ACCESS_TOKEN` não é um token de verdade do fluxo certo — geralmente é (a) um valor curto tipo chave hexadecimal colado por engano no lugar do token (parece com o formato do `MILSOCIAL_SYNC_KEY`), ou (b) um token gerado no **Explorador da Graph API** genérico da Meta, que serve pra `graph.facebook.com` e não pra `graph.instagram.com` (ver aviso na seção 2).  
**Solução:** Gere o token pelo caminho certo (seção 2, dentro do caso de uso "Gerenciar mensagens e conteúdo no Instagram" → Personalizar) — o valor deve ser uma string longa começando com `IGAA` ou `IGQVJheW`, não uma chave hex curta. Cole no Render, salve, e aguarde o redeploy automático.

### Item "MilSocial" não aparece no menu mesmo com tudo configurado

**Causa:** O item só aparece pro dono (comparação de `NEXT_PUBLIC_OWNER_EMAIL` com o e-mail logado — ver seção 3.3), e o e-mail configurado precisa ser EXATAMENTE o e-mail que você usa pra logar no MilLead (não necessariamente `rick@milweb.com.br`, ajuste pro seu caso real).  
**Solução:** Confirme o e-mail exato de login em Configurações → Perfil dentro do MilLead, compare com o valor salvo em `NEXT_PUBLIC_OWNER_EMAIL` na Vercel, corrija se divergir, e confirme com `vercel inspect millead.milweb.com.br` que o domínio está mesmo servindo o deployment mais recente (ver aviso na seção 3.3 sobre deploy não "pegar" sozinho).

### Erro 401 no workflow do GitHub Actions

São **dois 401 diferentes**, e a mensagem no corpo da resposta diz qual é. O workflow imprime esse corpo (`--fail-with-body`) justamente pra você não precisar adivinhar:

| Mensagem no corpo                    | Significado                                                                       | Solução                                                                       |
| ------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `"Chave de sincronização inválida."` | O header chegou, mas o valor não bate com `MILSOCIAL_SYNC_KEY` do Render          | Cole no GitHub o valor **exato** que está no Render                           |
| `"Token de acesso ausente."`         | O header **não chegou** — o secret está vazio, e o curl descarta header sem valor | Crie o secret (seção 5.1); o primeiro passo do workflow já detecta isso antes |

Esse segundo caso é traiçoeiro: parece erro de sessão de usuário, mas é o secret faltando. Foi o que manteve o sync quebrado por dias enquanto o painel funcionava normalmente — o botão "Sincronizar agora" usa sessão do dono, um caminho de auth totalmente diferente do cron.

### Os números não batem com o app do Instagram

**Causa:** Não é bug. A Insights API da Meta devolve **apenas dados orgânicos** e não reporta interações vindas de anúncios; o app do Instagram soma orgânico + pago na mesma tela. Num post impulsionado a diferença chega a dezenas de vezes.

**Como reconhecer:** compare as interações. Se alcance e views divergem muito (10x, 40x) mas curtidas/comentários/compartilhamentos estão quase iguais, é impulsionamento — anúncio compra impressão, não engajamento. Se **todas** as métricas divergirem na mesma proporção, aí sim investigue o sync.

**Solução:** nenhuma pelo lado do MilLead. Trazer dados pagos exige conta de Meta Ads conectada e Marketing API, que é uma integração separada. O painel já avisa que as métricas são orgânicas.

### Sync completa mas a lista de posts está vazia

**Causa:** Conta ainda não tem nenhum post publicado, ou o token não tem acesso à mídia da conta.  
**Solução:** Publique um post novo na @milweb e sincronize novamente — o próximo sync (manual ou agendado) traz o post e seus insights.

### Painel avisa "Token expirado"

**Causa:** Token long-lived chegou ao fim de sua validade de 60 dias ou foi revogado manualmente.  
**Solução:**

1. Repita a seção 2 (Criar o App na Meta e Gerar Token) — o processo é idêntico
2. Copie o novo token
3. Atualize `INSTAGRAM_ACCESS_TOKEN` no Render e redeploy
4. Clique em "Sincronizar Agora" no painel para reativar

### Primeira aplicação do schema

A migration `add_milsocial_models` foi criada, mas pode ainda não ter sido aplicada ao banco. Antes do primeiro sync, rode:

```bash
pnpm --filter @millead/database migrate:deploy
```

Este comando pode ser rodado várias vezes sem risco — Prisma mantém controle de qual migration foi aplicada e pula as anteriores.

---

## Referências Rápidas

| O quê                             | Onde                                          |
| --------------------------------- | --------------------------------------------- |
| Dashboard Meta Developers         | https://developers.facebook.com               |
| Painel MilSocial                  | https://millead.milweb.com.br/admin/milsocial |
| Render (API)                      | https://dashboard.render.com                  |
| Vercel (Web)                      | https://vercel.com/dashboard                  |
| Workflow do sync (GitHub Actions) | https://github.com/rickjs2005/millead/actions |
