"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useVaultCategories, useVaultMonthSummary } from "@/features/vault/finance-hooks";
import { formatCurrency } from "@/utils/format";

/** `AAAA-MM` de hoje, no fuso local — é o mês que a pessoa está vivendo. */
export function mesAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

function deslocarMes(mes: string, passos: number): string {
  const [ano, m] = mes.split("-").map(Number);
  // Aritmética de mês do próprio Date: somar 1 a dezembro vira janeiro do ano
  // seguinte sozinho, sem tabela de meses.
  const d = new Date(ano!, m! - 1 + passos, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function rotuloMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(ano!, m! - 1, 1),
  );
}

/**
 * O mês, com os números que o resto do Cofre alimenta.
 *
 * **Entrou e saiu** é o que atravessou a conta. **Consumo pessoal** é outra
 * coisa: o que sobra depois de tirar a parte da MilWeb e o que alguém vai
 * devolver. Os dois aparecem juntos de propósito — confundir um com o outro é
 * o erro que este módulo inteiro foi desenhado para evitar, e escondê-los um
 * do outro seria deixar a confusão acontecer na cabeça de quem lê.
 *
 * Transferências e baixas de dívida aparecem numa linha à parte em vez de
 * sumirem: elas movem dinheiro sem serem receita nem despesa, e omiti-las
 * faria a pessoa procurar um valor que saiu da conta e não está em lugar
 * nenhum da tela.
 */
export function MonthSummaryCard({
  mes,
  onMudarMes,
}: {
  mes: string;
  onMudarMes: (mes: string) => void;
}) {
  const resumo = useVaultMonthSummary(mes);
  const categories = useVaultCategories();

  const nomeCategoria = (id: string | null) => {
    if (!id) return "Sem categoria";
    for (const raiz of categories.data ?? []) {
      if (raiz.id === id) return raiz.name;
      const filha = raiz.children.find((c) => c.id === id);
      if (filha) return `${raiz.name} / ${filha.name}`;
    }
    return "Sem categoria";
  };

  const dados = resumo.data;
  const foraLancamentos =
    (dados?.foraDoFluxo.transferencias.lancamentos ?? 0) +
    (dados?.foraDoFluxo.baixasDivida.lancamentos ?? 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base capitalize">{rotuloMes(mes)}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Mês anterior"
            onClick={() => onMudarMes(deslocarMes(mes, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Próximo mês"
            // Mês futuro não tem movimentação, e um painel vazio parece defeito.
            disabled={mes >= mesAtual()}
            onClick={() => onMudarMes(deslocarMes(mes, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {resumo.isPending && <Skeleton className="h-24 w-full" />}

        {dados && dados.lancamentos === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma movimentação neste mês. Importe um extrato para começar.
          </p>
        )}

        {dados && dados.lancamentos > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Numero rotulo="Entrou" valor={dados.entradas} />
              <Numero rotulo="Saiu" valor={dados.saidas} />
              <Numero
                rotulo="Resultado"
                valor={dados.resultado}
                negativo={Number(dados.resultado) < 0}
              />
            </div>

            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Do que saiu</div>
              <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <Fatia rotulo="foi consumo seu" valor={dados.consumoPessoal} sempre />
                <Fatia rotulo="é da MilWeb" valor={dados.daEmpresa} />
                <Fatia rotulo="alguém devolve" valor={dados.reembolsavel} />
              </div>
            </div>

            {foraLancamentos > 0 && (
              <p className="text-xs text-muted-foreground">
                Fora da conta acima:{" "}
                {dados.foraDoFluxo.transferencias.lancamentos > 0 && (
                  <>
                    {formatCurrency(dados.foraDoFluxo.transferencias.total)} em transferências
                    {dados.foraDoFluxo.baixasDivida.lancamentos > 0 ? " e " : ""}
                  </>
                )}
                {dados.foraDoFluxo.baixasDivida.lancamentos > 0 && (
                  <>{formatCurrency(dados.foraDoFluxo.baixasDivida.total)} em baixas de dívida</>
                )}
                . Movem dinheiro, mas não são receita nem despesa — o valor já foi contado quando o
                gasto aconteceu.
              </p>
            )}

            {dados.porCategoria.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Consumo pessoal por categoria</div>
                {dados.porCategoria.slice(0, 8).map((linha) => (
                  <Barra
                    key={linha.categoryId ?? "sem-categoria"}
                    nome={nomeCategoria(linha.categoryId)}
                    total={linha.total}
                    maximo={dados.porCategoria[0]!.total}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Numero({
  rotulo,
  valor,
  negativo,
}: {
  rotulo: string;
  valor: string;
  negativo?: boolean;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={`text-xl font-semibold tabular-nums ${negativo ? "text-destructive" : ""}`}>
        {formatCurrency(valor)}
      </div>
    </div>
  );
}

/** Fatias zeradas somem — exceto o consumo pessoal, que é a resposta à
 *  pergunta principal e vale zero também. */
function Fatia({ rotulo, valor, sempre }: { rotulo: string; valor: string; sempre?: boolean }) {
  if (!sempre && Number(valor) <= 0) return null;
  return (
    <span>
      <span className="font-medium tabular-nums">{formatCurrency(valor)}</span>{" "}
      <span className="text-muted-foreground">{rotulo}</span>
    </span>
  );
}

function Barra({ nome, total, maximo }: { nome: string; total: string; maximo: string }) {
  const pct = Number(maximo) > 0 ? Math.round((Number(total) / Number(maximo)) * 100) : 0;
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate">{nome}</span>
        <span className="tabular-nums text-muted-foreground">{formatCurrency(total)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
