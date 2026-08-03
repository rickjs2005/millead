import type { ReceivableKind } from "../../domain/entities/receivable.js";

/**
 * REFERENCIA da regra de distribuicao de parcelas -- este e o contrato
 * espelhado manualmente em `apps/web/.../plan-dialog.tsx`
 * (buildInstallmentsPreview) pra gerar o preview visual do plano. O
 * `ReceivableService.createPlan` NAO chama `buildPlan`: ele recebe a
 * composicao (entrada + parcelas) ja montada pelo cliente e valida apenas
 * que a SOMA bate com o total do contrato (tolerancia de R$0,01) -- nao
 * valida a distribuicao item a item. Se este algoritmo mudar, o preview no
 * front precisa mudar junto (isso e responsabilidade de quem alterar um
 * dos dois lados).
 */

/** Entradas para o builder puro do plano de parcelas (sem I/O). */
export interface PlanInput {
  total: number; // valor total do contrato (reais)
  entryAmount: number; // entrada em reais (0 = sem entrada)
  installmentCount: number; // N parcelas alem da entrada (>= 1 se entryAmount < total)
  firstDueDate: Date; // vencimento da 1a parcela
  entryDueDate: Date; // vencimento da entrada
}

export interface PlanItem {
  kind: ReceivableKind;
  installmentIndex: number;
  amount: number;
  dueDate: Date;
}

/** Converte reais em centavos inteiros (evita arrastar imprecisao de float). */
function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Soma `months` a `date` preservando o dia do mes; quando o mes destino e
 *  mais curto (ex.: 31/01 + 1 mes), usa o ULTIMO dia daquele mes (28/02,
 *  29/02, 30/04...). */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const target = new Date(date);
  target.setDate(1); // evita overflow de dia ao trocar de mes
  target.setMonth(target.getMonth() + months);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInTargetMonth));
  return target;
}

/** Distribui (total - entrada) em N parcelas iguais com 2 casas; o resto
 *  de centavos vai na ULTIMA parcela. Vencimentos mensais a partir de
 *  firstDueDate (mesmo dia; meses curtos usam o ultimo dia do mes).
 *  Lanca RangeError se entrada > total, N < 0, total <= 0, ou
 *  (entrada < total && N < 1). entryAmount 0 nao gera item ENTRADA. */
export function buildPlan(input: PlanInput): PlanItem[] {
  const { total, entryAmount, installmentCount, firstDueDate, entryDueDate } = input;

  if (total <= 0) {
    throw new RangeError("total deve ser maior que zero");
  }
  if (entryAmount > total) {
    throw new RangeError("entrada nao pode ser maior que o total");
  }
  if (installmentCount < 0) {
    throw new RangeError("numero de parcelas nao pode ser negativo");
  }
  if (entryAmount < total && installmentCount < 1) {
    throw new RangeError("e preciso ao menos 1 parcela quando a entrada nao cobre o total");
  }

  const items: PlanItem[] = [];

  if (entryAmount > 0) {
    items.push({ kind: "ENTRADA", installmentIndex: 0, amount: entryAmount, dueDate: entryDueDate });
  }

  if (installmentCount >= 1) {
    const totalCents = toCents(total);
    const entryCents = toCents(entryAmount);
    const remainingCents = totalCents - entryCents;

    // arredondamento por parcela: floor -- garante que nenhuma parcela,
    // exceto a ultima, fique acima do valor exato dividido.
    const perInstallmentCents = Math.floor(remainingCents / installmentCount);
    const lastCents = remainingCents - perInstallmentCents * (installmentCount - 1);

    for (let i = 0; i < installmentCount; i++) {
      const isLast = i === installmentCount - 1;
      const amountCents = isLast ? lastCents : perInstallmentCents;
      items.push({
        kind: "PARCELA",
        installmentIndex: i + 1,
        amount: amountCents / 100,
        dueDate: addMonthsClamped(firstDueDate, i),
      });
    }
  }

  return items;
}
