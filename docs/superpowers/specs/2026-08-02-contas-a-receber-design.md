# Contas a receber (design)

**Data:** 2026-08-02
**Status:** aprovado pelo Rick (brainstorm em sessão; decisão: entrada +
parcelas com baixa manual, sem gateway)
**Depende de:** `2026-08-02-aceite-publico-contrato-herdado-design.md`
(vínculo `Contract.proposalId` — usado pra margem realizada)

## Objetivo

Fechar o último elo do funil: hoje nada registra o que a MilWeb tem a
receber. O contrato assinado ganha um plano de recebimento (entrada +
parcelas), o dono dá baixa manualmente quando o dinheiro cai, e o sistema
mostra a receber, vencidas e margem realizada vs projetada.

## Não-escopo (YAGNI)

- Gateway de cobrança (PIX/boleto automático) — só se a baixa manual doer.
- Nota fiscal, impostos, conciliação bancária.
- Multa/juros de atraso — vencida é só um estado visual.
- Editar plano depois de parcelas pagas (permitido só excluir/recriar
  parcelas ainda não pagas).

## Modelo (Prisma)

`Receivable` (org-scoped, padrão do schema):

- `id`, `organizationId`, `contractId` + relation
- `kind` enum `ReceivableKind { ENTRADA, PARCELA }`
- `installmentIndex Int` — 0 pra entrada, 1..N pras parcelas
- `amountCents Int` — valor em centavos (padrão do repo pra dinheiro;
  conferir como Proposal/Estimate guardam e seguir igual)
- `dueDate DateTime`
- `paidAt DateTime?` — null = em aberto
- `paidNote String?` — observação da baixa ("PIX conta PJ")
- `createdAt/updatedAt`
- `@@unique([contractId, installmentIndex])`, index em `organizationId,
dueDate`

"Vencida" é derivado (`paidAt == null && dueDate < hoje`) — sem job, sem
status materializado.

## Fluxo

1. **Definir plano** (contrato ASSINADO; permitido também em
   AGUARDANDO_ASSINATURA pra deixar pronto): o dono informa valor total
   (prefill: valor do contrato), entrada (% ou R$) e nº de parcelas; o
   sistema sugere vencimentos mensais a partir de uma data inicial
   (editáveis um a um antes de salvar). Validação: entrada + parcelas =
   total (centavo de ajuste vai na última parcela).
2. **Baixa**: marcar parcela como paga (data default hoje, editável +
   observação). Desfazer baixa permitido (erro de clique).
3. **Recriar plano**: só se nenhuma parcela paga; senão, editar apenas
   parcelas em aberto (valor/vencimento) ou adicionar parcela extra.

## API

`/api/v1/receivables` (autenticado; permissão: reusa `proposals:read/write`
como custos/contratos — mesmo atalho documentado):

- `POST /plan` — `{ contractId, totalCents, entryCents, installments:
[{ amountCents, dueDate }] }` (o front monta a sugestão; o back valida
  soma e cria tudo numa transação; 409 se contrato já tem parcela paga)
- `GET ?contractId=` — parcelas de um contrato
- `GET /summary?month=` — agregados: a receber no mês, vencidas (total e
  lista), recebido no mês
- `PATCH /:id/pay` — `{ paidAt?, paidNote? }`; `PATCH /:id/unpay`
- `PATCH /:id` — valor/vencimento (só em aberto)
- `DELETE /:id` — só em aberto
- `GET /margin?contractId=` — margem realizada: recebido, valor vendido
  (contrato), custo projetado (via `contract.proposalId` → proposta →
  `estimateId` → custo total do orçamento congelado). Contrato sem
  proposta vinculada: devolve só recebido vs vendido, campo de custo null.

## Web

- **`/receivables`** (nova rota no grupo `(app)`, nav "Financeiro" junto de
  Custos, permissão `proposals:read`): visão geral — cards (a receber no
  mês, vencidas, recebido no mês), lista de vencidas em destaque, lista por
  contrato com progresso (pago/total) e margem realizada (recebido − custo
  projetado, com % sobre o vendido).
- **Detalhe do contrato**: seção "Recebimento" — sem plano: botão "Definir
  plano" (dialog com o builder de parcelas); com plano: tabela de parcelas
  (status, vencimento, valor, botão baixa/desfazer).
- **Dashboard**: card "A receber" (total em aberto + vencidas em vermelho),
  padrão dos cards existentes.

## Erros

- Baixa dupla → 409; soma do plano errada → 422 com diferença; excluir/
  editar parcela paga → 409; plano pra contrato de outra org → 404
  (org-scoped padrão).

## Testes

- Builder do plano (função pura): distribuição de parcelas, centavo de
  ajuste na última, validação de soma.
- Service: criar plano (transação, 409 com parcela paga), baixa/desfazer,
  derivação de vencida, summary por mês, margem com e sem proposta
  vinculada.
- DTO: valores negativos, datas inválidas, installments vazio.
