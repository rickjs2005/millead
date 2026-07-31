"use client";

import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CostSubscriptionDialog } from "@/features/finance/components/cost-subscription-dialog";
import { CostSubscriptionsList } from "@/features/finance/components/cost-subscriptions-list";
import { CostSummaryCards } from "@/features/finance/components/cost-summary-cards";
import { FinanceSettingsDialog } from "@/features/finance/components/finance-settings-dialog";

export default function CostsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Centro de Custos</h1>
          <p className="text-sm text-muted-foreground">
            Quanto custa manter a MilWeb e quanto cada cliente consome
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FinanceSettingsDialog
            trigger={
              <Button variant="outline">
                <Settings /> Configurações
              </Button>
            }
          />
          <CostSubscriptionDialog
            trigger={
              <Button>
                <Plus /> Adicionar assinatura
              </Button>
            }
          />
        </div>
      </div>

      <CostSummaryCards />

      <Card className="overflow-hidden p-0">
        <CostSubscriptionsList />
      </Card>
    </div>
  );
}
