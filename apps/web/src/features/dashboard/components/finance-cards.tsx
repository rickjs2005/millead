"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, FileSignature, HandCoins } from "lucide-react";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { contractsService } from "@/services/contracts";
import { leadsService } from "@/services/leads";
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

  if (!canContracts && !canLeads) return null;

  const contractsSum = Number(kpis.data?.valorFechado ?? 0);
  const wonWithoutContractSum = Number(finance.data?.wonWithoutContractSum ?? 0);
  const total = contractsSum + wonWithoutContractSum;
  const loading = (canContracts && kpis.isLoading) || (canLeads && finance.isLoading);

  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Financeiro
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      </div>
    </div>
  );
}
