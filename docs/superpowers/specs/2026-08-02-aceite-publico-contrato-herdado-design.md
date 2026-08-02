# Aceite público de proposta + contrato herdado (design)

**Data:** 2026-08-02
**Status:** aprovado pelo Rick (brainstorm em sessão; decisões: página com resumo+PDF+botões; aceite cria contrato em rascunho pra revisão do dono; recebimento fica na spec B)
**Spec irmã:** `2026-08-02-contas-a-receber-design.md` (depende do vínculo proposta→contrato criado aqui)

## Objetivo

Fechar dois elos quebrados do funil comercial do MilLead:
1. O cliente não tem onde aceitar uma proposta — hoje o dono marca ACCEPTED
   na mão com base em conversa de WhatsApp, sem rastreio nenhum.
2. O contrato não nasce da proposta — sem vínculo, valores redigitados.

Depois desta spec: proposta enviada gera link público; o cliente abre
(VIEWED automático), lê o PDF e decide; o aceite cria o contrato em
rascunho com tudo herdado; o dono revisa e dispara a assinatura.

## Não-escopo (YAGNI)

- Cobrança/recebimento — spec B.
- Negociação pela página (contraproposta, comentários) — o cliente que quer
  ajustar fala com o dono como sempre; a recusa tem campo de motivo.
- Assinatura na própria página de aceite — assinatura continua no fluxo de
  contrato (ZapSign) existente.
- E-assinatura do aceite com validade jurídica — o aceite é comercial
  (registro de decisão com IP/data), o documento jurídico é o contrato.

## Modelo (Prisma)

`Proposal` ganha campos (org-scoped como já é):
- `publicToken String? @unique` — ~100 bits url-safe, mesmo padrão do token
  de briefing; gerado na primeira transição para SENT (idempotente: se já
  existe, mantém — reenvio não invalida link antigo).
- `viewedAt DateTime?` — primeira abertura pública.
- `decidedAt DateTime?` — momento do aceite/recusa pública.
- `decisionIp String?` — IP registrado na decisão.
- `rejectReason String? @db.Text` — motivo opcional da recusa.

`Contract` ganha:
- `proposalId String? @unique` + relation — o vínculo que faltava.
  `@unique` de propósito: 1 proposta gera no máximo 1 contrato.

Statuses existentes de Proposal são reusados (DRAFT/SENT/VIEWED/ACCEPTED/
REJECTED/EXPIRED) — sem enum novo.

## API

### Rotas públicas (novas) — `/api/v1/public/proposals`

Sem autenticação, rate-limit no padrão da rota pública de fechamento
(`/fechamento`). Lookup sempre por token (nunca por id).

- `GET /:token` — dados públicos da proposta: título, escopo (resumo),
  valor, validade (`validUntil`), nome da organização, URL do PDF, status.
  Efeito colateral: se status SENT, marca VIEWED + `viewedAt` + atividade
  na timeline do lead (uma vez só). Token inexistente → 404. Proposta
  DRAFT → 404 (link só funciona depois de enviada).
- `POST /:token/accept` — transição atômica SENT|VIEWED → ACCEPTED
  (`decidedAt`, `decisionIp`, `respondedAt`). Regras:
  - Expirada (`validUntil` < hoje) → 410 com mensagem clara; a checagem é
    no backend, não só na tela. Se status ainda não era EXPIRED, marca.
  - Já decidida (ACCEPTED/REJECTED) → 409 (idempotência: repetir aceite da
    mesma proposta já aceita retorna 200 com o estado atual, não erro —
    duplo clique não pode virar erro pro cliente).
  - Efeitos: cria o contrato em rascunho (ver "Herança" abaixo), notifica
    o dono (push PWA + e-mail, padrão briefing-notifier), loga atividade.
    Falha na criação do contrato NÃO desfaz o aceite (aceite é o fato;
    contrato dá pra criar de novo à mão) — mas é logada e a notificação
    menciona que o rascunho falhou.
- `POST /:token/reject` — mesma máquina de estados, body `{ reason? }`
  (max 2000 chars). Notifica o dono com o motivo. Não cria nada.

### Herança proposta → contrato

Ao aceitar, cria `Contract` DRAFT com:
- `proposalId`, `organizationId`, `companyId` e `leadId` da proposta;
- valor: o `price` da proposta (que já veio da cascata do orçamento);
- descrição do objeto/escopo: título da proposta + escopo do orçamento de
  origem (via `estimateId` da proposta, quando houver);
- dados do contratante: os mesmos que o prefill de briefing já monta
  (empresa/contato), reusando esse código onde der.
Condições de pagamento, prazos e cláusulas ficam vazios/default — decisão
do dono na revisão. O contrato NÃO entra na fila de assinatura
automaticamente.

### Rotas autenticadas (ajustes)

- Transição para SENT (já existe): passa a gerar `publicToken` e o e-mail
  enviado inclui o link `/p/:token` além do PDF anexado.
- `GET` da proposta (detalhe) passa a devolver `publicToken`, `viewedAt`,
  `decidedAt`, `rejectReason` — a UI mostra o link (botão copiar) e o
  rastreio.
- Marcação manual de ACCEPTED/REJECTED continua existindo (cliente que
  aceita por telefone) — mas se já houver decisão pública, a manual não
  sobrescreve (409 com mensagem).

## Web

### Página pública `/p/[token]` (fora do grupo `(app)`)

Padrão visual do `/fechamento` e `/b/:token` (marca MilWeb, sem shell do
CRM). Conteúdo: cabeçalho com título e organização; resumo (valor
formatado, validade, escopo curto); PDF embutido (iframe da URL do Blob);
botões Aceitar (primário) e Recusar (secundário → abre campo de motivo
opcional + confirmação). Estados: expirada (mensagem "proposta expirada,
fale com a gente" + WhatsApp da MilWeb, sem botões); já aceita (mensagem de
confirmação + "em breve você recebe o contrato"); já recusada (mensagem
neutra). Mobile-first — cliente abre no celular.

### Telas internas

- Detalhe da proposta: bloco "Link público" (copiar link, status de
  visualização "aberta em <data>", decisão com data/motivo).
- Proposta ACCEPTED com contrato criado: link direto "Ver contrato".
- `middleware.ts`: `/p` NÃO entra em APP_PREFIXES (é público) — conferir
  que o matcher não bloqueia.

## Erros e segurança

- Token com entropia ≥100 bits, lookup por igualdade exata; 404 uniforme
  pra token errado (não distinguir "não existe" de "draft").
- Rate-limit nas 3 rotas públicas (mesma config do fechamento).
- IP registrado vem de `req.ip` (TRUST_PROXY_HOPS já configurado).
- PDF: a URL do Blob já é pública por natureza (como no fluxo atual de
  e-mail); sem mudança.
- Aceite/recusa atômicos via update condicional no status (mesmo padrão da
  transição atômica do briefing COMPLETED).

## Testes

Padrão do repo (vitest junto do código):
- DTO: reason max length; token format.
- Service: máquina de estados (SENT→VIEWED no GET só uma vez; aceite de
  SENT e de VIEWED; 410 expirada marca EXPIRED; idempotência do aceite
  repetido; recusa com/sem motivo; manual não sobrescreve decisão pública);
  herança do contrato (campos certos, escopo do orçamento, contrato único
  por proposta); falha na criação do contrato não desfaz aceite.
- Rotas públicas: 404 token inexistente/draft; rate-limit presente (smoke).
