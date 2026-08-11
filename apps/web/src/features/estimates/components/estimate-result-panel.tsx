import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/utils/format";
import type { EstimateComputed, ProjectProduct } from "@/types/api";

function Row({
  label,
  value,
  primary,
  strong,
}: {
  label: string;
  value: string;
  primary?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={strong || primary ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          primary
            ? "text-lg font-semibold text-primary"
            : strong
              ? "text-base font-semibold text-foreground"
              : "font-medium text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Painel sticky de resultado do orçamento -- puramente apresentacional, só
 * recebe o `EstimateComputed` já calculado (server na tela de edição via
 * `computed` da API, ou o espelho client `computeEstimate` no preview ao
 * vivo do formulário). Nunca faz conta aqui.
 */
export function EstimateResultPanel({
  computed,
  hourlyRate,
  infraMonths,
  agencyShareMonthly,
  domainYears,
  product,
  children,
}: {
  computed: EstimateComputed;
  hourlyRate: number;
  infraMonths: number;
  agencyShareMonthly: number;
  /** 0 quando o orçamento não tem domínio contratado. */
  domainYears: number;
  product?: ProjectProduct;
  /** Bloco de "Preço final (você decide)" -- renderizado pelo editor (é o
   * único lugar com acesso ao `control` do react-hook-form), mas visualmente
   * pertence a este painel, logo abaixo dos 3 preços sugeridos. */
  children?: ReactNode;
}) {
  const rateioNoPeriodo = agencyShareMonthly * infraMonths;
  // `computed.infraCost` já inclui `oneTimeCost` (é o que `totalCost` precisa
  // somar) -- pra exibir "Infra + rateio no período" só com os itens
  // mensais (o custo único aparece na linha própria acima), recalculamos
  // aqui a fatia recorrente sem o one-time.
  const infraRecurringNoPeriodo = computed.infraMonthlyBrl * infraMonths + rateioNoPeriodo;

  return (
    <Card className="sticky top-4 h-fit">
      <CardHeader>
        <CardTitle>Cálculo do orçamento</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Row
          label={`Desenvolvimento (${computed.totalHours}h × ${formatCurrency(hourlyRate)})`}
          value={formatCurrency(computed.devCost)}
        />
        <Row
          label="Infra mensal (itens de custo)"
          value={`${formatCurrency(computed.infraMonthlyBrl)}/mês`}
        />
        <Row
          label={`Rateio da agência (${formatCurrency(agencyShareMonthly)}/mês)`}
          value={formatCurrency(rateioNoPeriodo)}
        />
        {computed.oneTimeCost > 0 && (
          <Row label="Custos únicos (créditos)" value={formatCurrency(computed.oneTimeCost)} />
        )}
        <Row
          label={`Infra + rateio no período (${infraMonths} ${infraMonths === 1 ? "mês" : "meses"})`}
          value={formatCurrency(infraRecurringNoPeriodo)}
        />
        <Row label="Reserva de suporte" value={formatCurrency(computed.supportReserve)} />
        {domainYears > 0 && (
          <Row
            label={`Domínio (${domainYears} ${domainYears === 1 ? "ano" : "anos"})`}
            value={formatCurrency(computed.domainCost)}
          />
        )}

        <Separator />

        <Row label="Custo real" value={formatCurrency(computed.totalCost)} strong />

        <Separator />

        <Row label="Preço mínimo" value={formatCurrency(computed.priceMin)} />
        <Row label="Preço recomendado" value={formatCurrency(computed.priceRecommended)} primary />
        <Row label="Preço premium" value={formatCurrency(computed.pricePremium)} />

        {children}

        {product && (
          <p className="mt-1 text-xs text-muted-foreground">
            Faixa do catálogo ({product.name}): {formatCurrency(product.priceMin)}–
            {formatCurrency(product.priceMax)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
