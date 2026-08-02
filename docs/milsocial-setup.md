# MilSocial: Setup de Token Instagram e Sincronização com n8n

MilSocial é a ferramenta interna do dono para sincronizar métricas do Instagram (@milweb) e gerar análise por IA sobre o desempenho por formato de post. Este guia cobre a configuração completa: conversão de conta, criação do app Meta, configuração de variáveis de ambiente, primeiro sync manual e automação via n8n.

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
8. Clique em **+ Adicionar Produto**
9. Procure por **Instagram** e clique em **Adicionar**
10. Na seção **Instagram Graph API**, vá para **Configuração de API com Login do Instagram**
11. Em **Instagram Tester**, clique em **Adicionar pessoas**
12. Digite o username da conta @milweb e confirme
13. Abra o app do Instagram na conta @milweb, vá em Configurações > Apps e Sites > Aplicativos e sites, e aceite o convite de tester
14. Volte ao dashboard do Meta e aguarde a aceitação ser refletida (refresh a página)
15. Na seção **Usuários de Teste**, clique em **Gerar Token**
16. Selecione as permissões (fluxo "Instagram API with Instagram Login"):
    - `instagram_business_basic`
    - `instagram_business_manage_insights`
17. Clique em **Gerar Token de Acesso** — este é o token long-lived (60 dias de validade)
18. Copie o token inteiro (será uma string longa começando com `IGQVJheW...`)

**Nota:** Tokens long-lived do Instagram expiram a cada 60 dias se não forem usados. O MilSocial renova automaticamente este token na primeira sincronização e persiste o novo token no banco de dados (tabela `SocialConfig`), então não é necessário atualizar manualmente.

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

Se tudo aparecer, o token foi renovado e armazenado no banco. A partir daqui, o n8n pode sincronizar automaticamente sem intervenção manual.

**Atenção — primeira carga histórica:** a primeira sincronização pagina todos os posts existentes do Instagram e busca insights de cada um; para contas com muito conteúdo isso pode levar minutos (bem mais que os ~30s de uma sync incremental do dia a dia). Prefira disparar a primeira sync pelo workflow do n8n (que já usa timeout de 120s, seção 5.2) em vez do botão do painel — o proxy do painel pode dar timeout antes da API terminar em background. Se isso acontecer, não é um erro real: o sync continua rodando no servidor e é idempotente (upsert por `igMediaId` e snapshot por dia), então basta aguardar e clicar em **Sincronizar agora** de novo mais tarde para confirmar que os dados chegaram.

**Aviso:** Se o painel avisa que o token expirou após alguns dias de inatividade, repita a seção 2 (gerar novo token) e atualize `INSTAGRAM_ACCESS_TOKEN` no Render. O ciclo de 60 dias reinicia.

## 5. Automação com n8n

Acesse [rickj.app.n8n.cloud](https://rickj.app.n8n.cloud) e crie um novo workflow com os seguintes passos:

### 5.1 Trigger: Scheduler

1. Adicione um **Schedule Trigger** (cron)
2. Configure para rodar **diariamente às 05:00 America/Sao_Paulo** (madrugada do horário de Brasília)
3. Deixe todas as outras opções em default

### 5.2 Node HTTP Request

1. Adicione um nó **HTTP Request**
2. Configure:
   - **Method:** POST
   - **URL:** `https://millead-api.onrender.com/api/v1/admin/social/sync`
   - **Headers** (clique em "Add" para cada um):
     - Header name: `X-Sync-Key`
     - Header value: Cole o valor exato de `MILSOCIAL_SYNC_KEY` (ex.: `3a7f2b9c1e5d4a8f6c2b9e1d3a7f2b9c1e5d4a8f`)
   - **Request Timeout:** 120 (segundos — covers cold start do Render)
   - **Retry on Fail:** Ativar
     - Retry times: `2`
     - Retry interval: `60` (segundos — aguarda warm-up do Render)

### 5.3 Ativar e Nomear

1. Clique em **Save**
2. Nomeie o workflow (ex.: "MilSocial Daily Sync")
3. Clique no botão **Activate Workflow** (ícone de play) no canto superior esquerdo
4. Teste clicando em **Execute Workflow** para confirmar que funciona

A partir daí, o workflow dispara automaticamente todo dia às 05:00 e sincroniza os reels sem qualquer ação manual.

## 6. Solução de Problemas

### Erro 503 ao clicar em "Sincronizar Agora"

**Causa:** Token não configurado ou chave `INSTAGRAM_ACCESS_TOKEN` vazia no Render.  
**Solução:** Verifique `INSTAGRAM_ACCESS_TOKEN` no Render, confirme que não está vazia, redeploy manual (`git push` ou botão de deploy no dashboard Render).

### Erro 401 no n8n (webhook rejeitado)

**Causa:** Header `X-Sync-Key` incorreto ou fora de sincronização com a chave no Render.  
**Solução:** Copie o valor exato de `MILSOCIAL_SYNC_KEY` novamente do Render e cole no header do n8n. Teste o workflow manualmente clicando em "Execute Workflow".

### Sync completa mas a lista de posts está vazia

**Causa:** Conta ainda não tem nenhum post publicado, ou o token não tem acesso à mídia da conta.  
**Solução:** Publique um post novo na @milweb e sincronize novamente — o próximo sync (manual ou do n8n) traz o post e seus insights.

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

| O quê | Onde |
|-------|------|
| Dashboard Meta Developers | https://developers.facebook.com |
| Painel MilSocial | https://millead.milweb.com.br/admin/milsocial |
| Render (API) | https://dashboard.render.com |
| Vercel (Web) | https://vercel.com/dashboard |
| n8n Workflow | https://rickj.app.n8n.cloud |
