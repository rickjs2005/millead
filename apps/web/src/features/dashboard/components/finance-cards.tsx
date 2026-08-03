"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, FileSignature, HandCoins, Receipt } from "lucide-react";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { queryKeys } from "@/lib/query-keys";
import { contractsService } from "@/services/contracts";
import { leadsService } from "@/services/leads";
import { receivablesService } from "@/services/receivables";
import { useAuthStore } from "@/stores/auth-store";
import { formatCurrency } from "@/utils/format";

/**
 * Receita realizada, com e sem contrato: `valorFechado` soma os contratos
 * ASSINADOS; `wonWithoutContractSum` soma os leads GANHOS sem contrato
 * assinado (a API já exclui os que têm, então o total nunca conta a mesma
 * venda duas vezes).
 */
export function FinanceCards() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canContracts = hasPermission("proposals:read");
  const canLeads = hasPermission("leads:read");
  // Mesma permissão de Contratos/Orçamentos (`proposals:read`) -- contas a
  // receber vive na mesma área financeira.
  const canReceivables = hasPermission("proposals:read");

  const kpis = useQuery({
    queryKey: ["dashboard", "contracts", "kpis"],
    queryFn: contractsService.kpis,
    enabled: canContracts,
  });
  const finance = useQuery({
    queryKey: ["dashboard", "leads", "finance"],
    queryFn: leadsService.finance,
    enabled: canLeads,
  });
  const receivables = useQuery({
    // Mesma key que useReceivablesSummary() usa pro mes atual (sem `month`)
    // -- precisa estar sob o prefixo `receivables` pra ser invalidada pelas
    // mutations de baixa/edicao/exclusao de parcela (ver invalidateAll em
    // features/receivables/hooks.ts).
    queryKey: queryKeys.receivables.summary(),
    queryFn: () => receivablesService.summary(),
    enabled: canReceivables,
  });

  if (!canContracts && !canLeads && !canReceivables) return null;

  const contractsSum = Number(kpis.data?.valorFechado ?? 0);
  const wonWithoutContractSum = Number(finance.data?.wonWithoutContractSum ?? 0);
  const total = contractsSum + wonWithoutContractSum;
  const loading = (canContracts && kpis.isLoading) || (canLeads && finance.isLoading);

  const toReceive = Number(receivables.data?.toReceive ?? 0);
  const overdue = Number(receivables.data?.overdue ?? 0);
  const overdueCount = receivables.data?.overdueItems.length ?? 0;

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Financeiro
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canContracts && (
          <StatCard
            label={`Fechado em contratos${kpis.data ? ` (${kpis.data.assinados})` : ""}`}
            value={formatCurrency(kpis.data?.valorFechado ?? 0)}
            icon={FileSignature}
            loading={loading}
          />
        )}
        {canLeads && (
          <StatCard
            label={`Ganhos sem contrato${finance.data ? ` (${finance.data.wonWithoutContractCount})` : ""}`}
            value={formatCurrency(finance.data?.wonWithoutContractSum ?? 0)}
            icon={HandCoins}
            loading={loading}
          />
        )}
        <StatCard
          label="Total ganho"
          value={formatCurrency(total)}
          icon={Banknote}
          loading={loading}
          accent="success"
        />
        {canReceivables && (
          <StatCard
            label={`A receber${overdueCount > 0 ? ` (${overdueCount} vencidas)` : ""}`}
            value={formatCurrency(toReceive + overdue)}
            icon={Receipt}
            loading={receivables.isLoading}
            accent={overdue > 0 ? "warning" : "default"}
          />
        )}
      </div>
    </div>
  );
}
