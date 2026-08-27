import { classifyCashFlow } from "./cash-flow-kind.js";
import { formatMoney, parseMoney } from "./vault-money.js";

/**
 * O resumo do mês — o lugar onde as regras de todas as fases se encontram.
 *
 * É aqui que a contagem dupla apareceria se ela existisse, e por isso este
 * arquivo é sobre uma identidade só:
 *
 *     saídas = consumo pessoal + parte da empresa + reembolsável
 *
 * Ela tem de fechar **exatamente**, ao centavo. Se fechar, nada se perdeu no
 * caminho e nada foi contado duas vezes. Há teste fixando isso com dados
 * misturados, e é o teste mais importante do módulo.
 *
 * Três coisas ficam fora de entradas e saídas, cada uma por um motivo já
 * decidido em outra fase:
 *
 * - **Transferência** entre contas suas: move dinheiro, não é fato novo.
 * - **Baixa de dívida**: o fato aconteceu quando a dívida nasceu (fase 6).
 * - **Movimentação estornada**: ninguém pagou por ela.
 *
 * As duas primeiras não somem do resumo — aparecem em `foraDoFluxo`, com o
 * total. Escondê-las faria a pessoa procurar dinheiro que "sumiu" da conta e
 * não está em lugar nenhum da tela.
 */

export interface SummarySplit {
  kind: "PERSONAL" | "REIMBURSABLE" | "BUSINESS";
  amount: string;
}

export interface SummaryTransaction {
  direction: "IN" | "OUT";
  amountBrl: string;
  status: string;
  isTransfer: boolean;
  settlesDebtId: string | null;
  categoryId: string | null;
  splits: SummarySplit[];
}

export interface CategoryLine {
  categoryId: string | null;
  total: string;
  lancamentos: number;
}

export interface MonthSummary {
  entradas: string;
  saidas: string;
  /** `entradas − saídas`. Pode ser negativo. */
  resultado: string;
  /** Quanto das saídas foi gasto **com você**. Nunca igual a `saidas` quando
   *  há rateio — e é a diferença entre "saiu da conta" e "eu gastei". */
  consumoPessoal: string;
  daEmpresa: string;
  reembolsavel: string;
  /** O que se moveu sem ser receita nem despesa, para o dinheiro não "sumir"
   *  da tela. */
  foraDoFluxo: {
    transferencias: { total: string; lancamentos: number };
    baixasDivida: { total: string; lancamentos: number };
  };
  /** Consumo pessoal por categoria, do maior pro menor. */
  porCategoria: CategoryLine[];
  lancamentos: number;
}

export function summarizeMonth(transactions: readonly SummaryTransaction[]): MonthSummary {
  let entradas = 0;
  let saidas = 0;
  let consumoPessoal = 0;
  let daEmpresa = 0;
  let reembolsavel = 0;
  let transferencias = 0;
  let transferenciasN = 0;
  let baixas = 0;
  let baixasN = 0;
  let lancamentos = 0;

  const categorias = new Map<string | null, { total: number; lancamentos: number }>();

  for (const t of transactions) {
    // Estornada não é gasto nem recebimento: a operação foi desfeita.
    if (t.status === "REVERSED") continue;
    lancamentos += 1;

    const valor = parseMoney(t.amountBrl);
    const tipo = classifyCashFlow(t);

    if (tipo === "TRANSFER") {
      transferencias += valor;
      transferenciasN += 1;
      continue;
    }
    if (tipo === "DEBT_SETTLEMENT") {
      baixas += valor;
      baixasN += 1;
      continue;
    }
    if (tipo === "INCOME") {
      entradas += valor;
      continue;
    }

    saidas += valor;

    const empresa = somaPorTipo(t.splits, "BUSINESS");
    const reembolso = somaPorTipo(t.splits, "REIMBURSABLE");
    // O resto é pessoal, tenha ou não divisão PERSONAL explícita. É a mesma
    // regra de `personalConsumption`: sem rateio, a compra é 100% sua.
    const pessoal = valor - empresa - reembolso;

    daEmpresa += empresa;
    reembolsavel += reembolso;
    consumoPessoal += pessoal;

    const linha = categorias.get(t.categoryId) ?? { total: 0, lancamentos: 0 };
    linha.total += pessoal;
    linha.lancamentos += 1;
    categorias.set(t.categoryId, linha);
  }

  return {
    entradas: formatMoney(entradas),
    saidas: formatMoney(saidas),
    resultado: formatMoney(entradas - saidas),
    consumoPessoal: formatMoney(consumoPessoal),
    daEmpresa: formatMoney(daEmpresa),
    reembolsavel: formatMoney(reembolsavel),
    foraDoFluxo: {
      transferencias: { total: formatMoney(transferencias), lancamentos: transferenciasN },
      baixasDivida: { total: formatMoney(baixas), lancamentos: baixasN },
    },
    porCategoria: [...categorias.entries()]
      .map(([categoryId, linha]) => ({
        categoryId,
        total: formatMoney(linha.total),
        lancamentos: linha.lancamentos,
      }))
      // Maior primeiro: a pergunta é "onde foi meu dinheiro", e a resposta
      // começa pelo maior buraco.
      .sort((a, b) => parseMoney(b.total) - parseMoney(a.total)),
    lancamentos,
  };
}

function somaPorTipo(splits: readonly SummarySplit[], kind: SummarySplit["kind"]): number {
  return splits
    .filter((s) => s.kind === kind)
    .reduce((total, s) => total + parseMoney(s.amount), 0);
}

/** Primeiro e último dia do mês, em UTC — a mesma base das datas do Cofre. */
export function monthRange(month: string): { from: Date; to: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (mes < 1 || mes > 12) return null;
  return {
    from: new Date(Date.UTC(ano, mes - 1, 1)),
    // Dia 0 do mês seguinte é o último dia deste — evita a tabela de "quantos
    // dias tem cada mês" e acerta fevereiro bissexto de graça.
    to: new Date(Date.UTC(ano, mes, 0)),
  };
}
