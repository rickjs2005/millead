import { normalizeDescription } from "./transaction-text.js";

/**
 * O que a movimentação É, além de entrada ou saída.
 *
 * Um extrato não traz só compras. Traz transferência entre contas suas,
 * pagamento de fatura, estorno, saque, tarifa — e cada um desses precisa de um
 * tratamento diferente, porque **três deles não são despesa nem receita**:
 *
 * - **Transferência própria**: o dinheiro mudou de bolso, não saiu. Contar
 *   como despesa numa conta e receita na outra dobra os dois lados.
 * - **Pagamento de fatura**: a despesa foi a compra no cartão. O pagamento é a
 *   quitação dela; contar de novo cobraria duas vezes.
 * - **Estorno**: desfaz uma compra. Entra como entrada, mas não é renda.
 *
 * Marcar isso na importação é o que impede a contagem dupla antes que ela
 * aconteça — e é a mesma decisão que o resumo do mês depende para fechar.
 *
 * ## Sinal, não certeza
 *
 * Isto sugere; não decide sozinho. Uma linha marcada como transferência entra
 * na prévia sinalizada, e é a pessoa que confirma. "PIX ENVIADO" pode ser
 * transferência entre suas contas ou pagamento a um fornecedor, e só quem
 * mandou sabe qual.
 */

export type TransactionKind =
  | "COMPRA"
  | "TRANSFERENCIA"
  | "PAGAMENTO_FATURA"
  | "ESTORNO"
  | "SAQUE"
  | "DEPOSITO"
  | "TARIFA"
  | "JUROS"
  | "BOLETO";

export interface KindGuess {
  kind: TransactionKind;
  /** Fica fora de receita e despesa — ver o comentário do topo. */
  neutral: boolean;
  confidence: "alta" | "media";
  matched: string | null;
}

/**
 * `TRNTYPE` do OFX, quando o arquivo declara.
 *
 * É a fonte mais confiável que existe: é o banco classificando a própria
 * movimentação. Só os tipos inequívocos entram aqui — `DEBIT` e `CREDIT` são
 * genéricos demais e não dizem nada além do sinal, que já veio no valor.
 */
const POR_TRNTYPE: Record<string, { kind: TransactionKind; neutral: boolean }> = {
  XFER: { kind: "TRANSFERENCIA", neutral: true },
  PAYMENT: { kind: "BOLETO", neutral: false },
  ATM: { kind: "SAQUE", neutral: false },
  CASH: { kind: "SAQUE", neutral: false },
  DEP: { kind: "DEPOSITO", neutral: false },
  DIRECTDEP: { kind: "DEPOSITO", neutral: false },
  FEE: { kind: "TARIFA", neutral: false },
  SRVCHG: { kind: "TARIFA", neutral: false },
  INT: { kind: "JUROS", neutral: false },
};

interface RegraTexto {
  termos: readonly string[];
  kind: TransactionKind;
  neutral: boolean;
  confidence?: "alta" | "media";
}

/** A ordem importa: o específico vem antes do genérico. */
const POR_TEXTO: readonly RegraTexto[] = [
  {
    termos: [
      "PAGAMENTO DE FATURA",
      "PGTO FATURA",
      "PAGAMENTO FATURA",
      "PAGTO FATURA",
      "PAGAMENTO CARTAO",
      "PAGAMENTO DE CARTAO",
    ],
    kind: "PAGAMENTO_FATURA",
    neutral: true,
  },
  {
    termos: [
      "ESTORNO",
      "DEVOLUCAO DE COMPRA",
      "CANCELAMENTO DE COMPRA",
      "REEMBOLSO",
      "CHARGEBACK",
      "REVERSAO",
    ],
    kind: "ESTORNO",
    neutral: true,
  },
  {
    termos: [
      "TRANSFERENCIA ENTRE CONTAS",
      "TRANSF ENTRE CONTAS",
      "APLICACAO AUTOMATICA",
      "RESGATE AUTOMATICO",
      "APLICACAO RDB",
      "RESGATE RDB",
      "APLICACAO CDB",
      "RESGATE CDB",
    ],
    kind: "TRANSFERENCIA",
    neutral: true,
  },
  {
    termos: ["TARIFA", "ANUIDADE", "MANUTENCAO DE CONTA", "CESTA DE SERVICOS", "IOF"],
    kind: "TARIFA",
    neutral: false,
  },
  { termos: ["JUROS", "ENCARGOS", "MULTA POR ATRASO"], kind: "JUROS", neutral: false },
  { termos: ["SAQUE", "RETIRADA", "ATM "], kind: "SAQUE", neutral: false },
  { termos: ["DEPOSITO", "DEPOSITO EM DINHEIRO"], kind: "DEPOSITO", neutral: false },
  {
    termos: ["BOLETO", "PAGAMENTO DE BOLETO", "PAGTO BOLETO", "CONVENIO"],
    kind: "BOLETO",
    neutral: false,
  },
  // Pix e TED por último, e com confiança MÉDIA: podem ser transferência entre
  // contas suas ou pagamento a terceiro, e a diferença muda se conta ou não
  // como despesa. Quem sabe é quem mandou.
  {
    termos: ["PIX ENVIADO", "PIX RECEBIDO", "PIX TRANSF", "TED ", "DOC ", "TRANSFERENCIA"],
    kind: "TRANSFERENCIA",
    neutral: false,
    confidence: "media",
  },
];

export function guessKind(description: string, trnType?: string | null): KindGuess {
  const tipo = trnType?.toUpperCase().trim();
  if (tipo && POR_TRNTYPE[tipo]) {
    const { kind, neutral } = POR_TRNTYPE[tipo]!;
    // O banco declarou. Não há palpite mais confiável que esse.
    return { kind, neutral, confidence: "alta", matched: tipo };
  }

  const texto = normalizeDescription(description);
  for (const regra of POR_TEXTO) {
    const termo = regra.termos.find((t) => texto.includes(t));
    if (!termo) continue;
    return {
      kind: regra.kind,
      neutral: regra.neutral,
      confidence: regra.confidence ?? "alta",
      matched: termo.trim(),
    };
  }

  return { kind: "COMPRA", neutral: false, confidence: "alta", matched: null };
}

/**
 * Duas movimentações são as duas pernas da mesma transferência?
 *
 * Mesmo valor, sentidos opostos, contas diferentes, datas próximas. A janela é
 * de três dias porque transferência entre bancos diferentes pode cair no dia
 * seguinte — e Pix agendado, no seguinte ao seguinte.
 *
 * Reconhecer o par é o que permite não contar duas vezes: uma perna sai de uma
 * conta e entra na outra, e o Cofre precisa saber que é o mesmo dinheiro.
 */
export interface TransferLeg {
  id: string;
  accountId: string | null;
  cardId: string | null;
  direction: "IN" | "OUT";
  amountCents: number;
  date: Date;
}

const JANELA_DIAS = 3;

export function findTransferPairs(legs: readonly TransferLeg[]): Array<[string, string]> {
  const pares: Array<[string, string]> = [];
  const usados = new Set<string>();

  for (const saida of legs.filter((l) => l.direction === "OUT")) {
    if (usados.has(saida.id)) continue;

    const entrada = legs.find(
      (l) =>
        l.direction === "IN" &&
        !usados.has(l.id) &&
        l.amountCents === saida.amountCents &&
        // Contas diferentes: dinheiro que sai e entra na MESMA conta é erro de
        // lançamento, não transferência.
        origem(l) !== origem(saida) &&
        Math.abs(l.date.getTime() - saida.date.getTime()) <= JANELA_DIAS * 86_400_000,
    );

    if (entrada) {
      pares.push([saida.id, entrada.id]);
      usados.add(saida.id);
      usados.add(entrada.id);
    }
  }

  return pares;
}

function origem(leg: TransferLeg): string {
  return leg.accountId ?? leg.cardId ?? "";
}
