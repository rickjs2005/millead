"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { businessExpenseService } from "@/services/costs";
import { formatCurrency } from "@/utils/format";
import type { ExpensePlanComparison } from "@/types/api";

/**
 * Planejado x realizado — lado a lado, nunca somados.
 *
 * Os cards de cima (`CostSummaryCards`) mostram o **planejado**: a soma dos
 * planos, que é uma previsão do custo mensal. Esta seção mostra o
 * **realizado**: o que de fato saiu no mês. Os dois falam do mesmo Claude, e
 * somar daria dois — por isso eles vivem em blocos separados, com a diferença
 * calculada por subtração e nunca um total único juntando os dois.
 */
function mesAtual(): { from: string; to: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const fim = new Date(ano, mes + 1, 0).getDate();
  const mm = String(mes + 1).padStart(2, "0");
  return { from: `${ano}-${mm}-01`, to: `${ano}-${mm}-${String(fim).padStart(2, "0")}` };
}

export function RealizedExpensesSection() {
  const { from, to } = mesAtual();
  const query = useQuery({
    queryKey: ["costs", "expenses", "summary", from, to],
    queryFn: () => businessExpenseService.summary(from, to),
  });

  if (query.isPending) return <Skeleton className="h-48 w-full" />;
  if (query.isError) {
    return <ErrorState description="Não foi possível carregar as despesas realizadas." />;
  }

  const resumo = query.data;
  const nada = resumo.realizadoBrl === 0 && resumo.porPlano.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Realizado no mês</CardTitle>
        <p className="text-sm text-muted-foreground">
          O que de fato saiu, comparado com o previsto. Os dois números não se somam — eles
          descrevem o mesmo custo, um antes e outro depois de acontecer.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Numero rotulo="Previsto no mês" valor={resumo.planejadoBrl} />
          <Numero rotulo="Realizado no mês" valor={resumo.realizadoBrl} />
          <Numero
            rotulo="Pago pelo dono"
            valor={resumo.doCofreBrl}
            nota="a empresa deve isso a ele"
          />
        </div>

        {nada && (
          <p className="text-sm text-muted-foreground">Nenhuma despesa lançada neste mês ainda.</p>
        )}

        {resumo.porPlano.length > 0 && (
          <div className="space-y-2">
            {resumo.porPlano.map((linha) => (
              <LinhaPlano key={linha.costSubscriptionId} linha={linha} />
            ))}
          </div>
        )}

        {resumo.semPlano.lancamentos > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2 text-sm">
            <span className="text-muted-foreground">
              Sem plano associado ({resumo.semPlano.lancamentos}{" "}
              {resumo.semPlano.lancamentos === 1 ? "lançamento" : "lançamentos"})
            </span>
            <span className="tabular-nums">{formatCurrency(resumo.semPlano.realizadoBrl)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: number; nota?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="text-xl font-semibold tabular-nums">{formatCurrency(valor)}</div>
      {nota && <div className="text-xs text-muted-foreground">{nota}</div>}
    </div>
  );
}

function LinhaPlano({ linha }: { linha: ExpensePlanComparison }) {
  // Tolerância de um real: diferença de centavos é arredondamento de câmbio, não
  // estouro — sinalizar isso treinaria a pessoa a ignorar o aviso.
  const estourou = linha.diferencaBrl > 1;
  const faltou = linha.diferencaBrl < -1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{linha.name}</span>
        {estourou && (
          <Badge variant="destructive" className="text-[10px]">
            +{formatCurrency(linha.diferencaBrl)}
          </Badge>
        )}
        {faltou && linha.lancamentos === 0 && (
          <Badge variant="outline" className="text-[10px]">
            sem cobrança ainda
          </Badge>
        )}
      </div>
      <div className="tabular-nums text-muted-foreground">
        previsto {formatCurrency(linha.planejadoBrl)} · realizado{" "}
        <span className="text-foreground">{formatCurrency(linha.realizadoBrl)}</span>
      </div>
    </div>
  );
}
