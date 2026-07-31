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
  product,
}: {
  computed: EstimateComputed;
  hourlyRate: number;
  infraMonths: number;
  agencyShareMonthly: number;
  product?: ProjectProduct;
}) {
  const rateioNoPeriodo = agencyShareMonthly * infraMonths;

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
        <Row label="Infra mensal (itens de custo)" value={`${formatCurrency(computed.infraMonthlyBrl)}/mês`} />
        <Row label={`Rateio da agência (${formatCurrency(agencyShareMonthly)}/mês)`} value={formatCurrency(rateioNoPeriodo)} />
        <Row
          label={`Infra + rateio no período (${infraMonths} ${infraMonths === 1 ? "mês" : "meses"})`}
          value={formatCurrency(computed.infraCost)}
        />
        <Row label="Reserva de suporte" value={formatCurrency(computed.supportReserve)} />

        <Separator />

        <Row label="Custo real" value={formatCurrency(computed.totalCost)} strong />

        <Separator />

        <Row label="Preço mínimo" value={formatCurrency(computed.priceMin)} />
        <Row label="Preço recomendado" value={formatCurrency(computed.priceRecommended)} primary />
        <Row label="Preço premium" value={formatCurrency(computed.pricePremium)} />

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
