# Finanças: séries mensais + dashboard completo — design

Data: 2026-08-09 · Status: escopo aprovado pelo Rick ("Faça p1+p2") a partir da auditoria financeira

## Contexto (achado da auditoria)

A queixa "não está somando os meses" NÃO é bug de cálculo: os cortes de mês
existentes (receivable-service `summary`, cost-service `getUsageSummary`) estão
corretos e testados. O problema é estrutural: **nenhuma tela nem endpoint soma
mais de um mês**. A Receber mostra 1 mês por vez; Custos são snapshot do agora +
consumo de 1 mês; KPIs de Contratos/Leads são lifetime sem filtro; o Dashboard
mistura granularidades (mês corrente ao lado de lifetime) sem nenhum gráfico de
dinheiro no tempo.

## Objetivo

**P1 — a soma dos meses:** séries mensais de verdade (recebíveis e custos),
totais do ano, e KPIs de contrato com recorte temporal.
**P2 — dashboard de dono:** gráfico receita × custo por mês, cards com
granularidade coerente, tarefas atrasadas em lista, feed de atividades e
atalhos de ação rápida.

## P1 — Backend (apps/api)

Todos os endpoints novos reusam as permissões `proposals:read` (mesmo padrão
dos irmãos receivables/costs) e o padrão de agregação em memória sobre uma
query filtrada (estilo `listForSummary`).

### 1. Série mensal de recebíveis

`GET /api/v1/receivables/summary/series?months=12`

- `months` opcional, default 12, clamp 1..24. Janela = últimos N meses
  terminando no mês corrente (fuso `America/Sao_Paulo` pro "mês corrente",
  cortes em UTC — mesmíssimo padrão de `monthRangeUtc`/`currentMonthInTimeZone`
  já existentes no service).
- Resposta (Decimal como string, padrão do domínio receivables):

```ts
interface ReceivableSeries {
  months: {
    month: string;      // "2025-09"
    received: string;   // soma de amount com paidAt no mês
    expected: string;   // soma de amount com dueDate no mês (pago ou não)
  }[];                  // SEMPRE N entradas — mês sem dado vem zerado
  yearTotals: {
    year: number;       // ano corrente (America/Sao_Paulo)
    received: string;   // paidAt no ano corrente
    expected: string;   // dueDate no ano corrente
  };
}
```

- Semântica: `received` = caixa realizado (regime de caixa); `expected` =
  competência pelo vencimento. Os dois juntos explicam o "sumiço" de parcela
  paga fora do mês do vencimento.
- Repo: um método novo `listForSeries(organizationId, from, to)` — receivables
  com `dueDate` OU `paidAt` dentro da janela; bucketização por mês no service.
- **Zero-fill obrigatório**: mês sem registro entra com "0.00" (a série nunca
  pula mês — é o bug clássico que a queixa sugere).
- Testes (vitest, junto dos existentes de receivable-service): bucketização
  paga vs vencimento em meses diferentes; mês vazio zerado; janela clamp;
  totais do ano.

### 2. Série mensal de custos (consumo)

`GET /api/v1/costs/usage/series?months=12`

- Mesma janela/clamp. Resposta (number BRL, padrão do domínio costs):

```ts
interface CostUsageSeries {
  months: { month: string; usageCostBrl: number }[]; // zero-fill idem
  yearTotal: number;            // consumo do ano corrente
  recurringMonthlyBrl: number;  // totalMonthlyBrl ATUAL das assinaturas ativas
}
```

- Custo de cada lançamento = mesma regra do `computeUsageSummary` atual
  (snapshot `unitPriceBrl` quando existe; senão preço derivado da assinatura
  com taxa atual) — extrair/reusar o cálculo por entrada, não duplicar.
- **Limitação documentada**: não existe histórico de assinaturas
  (CostSubscription não é versionada), então o recorrente é UMA constante
  atual, não uma série histórica. O front apresenta como linha de referência
  "custo fixo atual", nunca como "custo fixo daquele mês".
- Repo: `listUsage` já aceita range — reusar com a janela toda.
- Testes: bucketização por `usedAt`, zero-fill, snapshot vs preço derivado.

### 3. KPIs de contrato com recorte temporal

`GET /api/v1/contracts/kpis` — resposta ESTENDIDA (sem parâmetro novo, sem
breaking change):

```ts
interface ContractKpis {
  total: number;
  aguardandoAssinatura: number;
  assinados: number;
  valorFechado: string;     // lifetime (mantido)
  valorFechadoMes: string;  // NOVO: assinadoEm no mês corrente
  valorFechadoAno: string;  // NOVO: assinadoEm no ano corrente
}
```

- Base temporal = `assinadoEm` (contrato ASSINADO com `assinadoEm` null fica
  só no lifetime). Cortes de mês/ano no mesmo padrão UTC + America/Sao_Paulo.
- Leads `wonSum` continua lifetime — o modelo Lead não tem timestamp de "won"
  (registrado como limitação; fora de escopo criar).

## P1 — Frontend (apps/web)

### /receivables
- Gráfico de barras (Recharts, já é dependência) com a série de 12 meses:
  `received` e `expected` lado a lado por mês; tooltip com valores formatados.
- Cards novos "Recebido no ano" e "Previsto no ano" (yearTotals).
- Card "Vencidas" ganha sublabel "acumulado geral (não segue o mês)" — hoje
  ele ignora o seletor de mês e parece quebrado.

### /costs
- Seção nova "Histórico de consumo" acima do CreditUsageSection: barras dos
  12 meses de `usageCostBrl` + linha/valor de referência do recorrente atual +
  card "Consumo no ano".

### /contracts
- Linha de KPIs passa a mostrar "Fechado no mês" e "Fechado no ano" junto do
  lifetime (rótulos claros: "desde o início").

### Tipos
- Novas interfaces em `apps/web/src/types/api.ts` espelhando as respostas.
- Services/hooks novos seguindo o padrão existente (react-query).

## P2 — Dashboard (apps/web)

Ordem visual nova da página:

1. Header (mantido) + **atalhos de ação rápida**: botões "+ Lead",
   "+ Tarefa", "+ Orçamento" (links pras rotas/dialogs existentes — sem
   modal novo; navegar já resolve).
2. **Gráfico Receita × Custo por mês** (12 meses): `received` da série de
   recebíveis vs `usageCostBrl + recurringMonthlyBrl` — ComposedChart
   Recharts (barras receita, linha custo). É o widget-âncora do dono.
3. **FinanceCards reorganizados em duas linhas com granularidade coerente:**
   - "Este mês": A receber · Recebido · Fechado em contratos (mês) · Custo
     mensal atual.
   - "Ano": Recebido no ano · Fechado no ano · Consumo no ano · **Resultado
     do ano** = recebido YTD − (consumo YTD + recorrente×meses decorridos) —
     rótulo honesto "estimativa (custo fixo = valor atual)".
4. StatCards (mantidos como estão).
5. Funil + pizza (mantidos).
6. Linha de listas vira 3 colunas: Próximas tarefas · **Tarefas atrasadas**
   (lista `GET /tasks?overdue=true&pageSize=5`, destaque vermelho) · Próximas
   reuniões.
7. **Atividades recentes** (feed `GET /leads/activities/recent`, já existe e
   só o sino usa) — lista compacta "o que aconteceu".

Fora de escopo do P2 (registrado para depois): funil com taxa de conversão
(exige endpoint novo), fix do N+1 do funil, MRR/receita recorrente, aging
30/60/90, fluxo de caixa projetado, export contábil, totais em /estimates.

## Validação

- API: vitest dos services novos (rodar suite do apps/api).
- Web: type-check + lint + build; verificação VISUAL obrigatória via padrão
  BFF-mock do Playwright (mockar os endpoints novos com séries fictícias de
  12 meses; olhar os prints de /receivables, /costs, /contracts e /dashboard).
- Sem tocar banco/API de produção.

## Entrega

Branch `financas-series-mensais` → reviews por task → review final → prints
pro Rick → merge na main + push. Deploy (web CLI/Render) só com pedido.
