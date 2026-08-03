"use client";

import { AlertTriangle, CheckCircle2, HandCoins, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/features/dashboard/components/stat-card";
import {
  usePayReceivable,
  useReceivableContracts,
  useReceivablesSummary,
} from "@/features/receivables/hooks";
import { formatCurrency } from "@/utils/format";
import type { ContractWithTotals, Receivable } from "@/types/api";

/** "YYYY-MM" do mês atual no fuso local -- default do seletor de mês. */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** `dueDate`/`nextDueDate` chegam date-only ("YYYY-MM-DD" ancorado em UTC) --
 * formatar no fuso do browser viraria o dia anterior em fusos negativos
 * (mesmo gotcha do `installments-card.tsx`). */
function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(
    new Date(value),
  );
}

function installmentLabel(r: Receivable): string {
  return r.kind === "ENTRADA" ? "Entrada" : `Parcela ${r.installmentIndex}`;
}

function OverdueRow({
  receivable,
  contract,
}: {
  receivable: Receivable;
  contract: ContractWithTotals | undefined;
}) {
  const pay = usePayReceivable();
  const { confirm, dialog } = useConfirmDialog();

  return (
    <TableRow>
      <TableCell>
        <Link href={`/contracts/${receivable.contractId}`} className="hover:underline">
          {contract ? `${contract.numero} · ${contract.companyName}` : receivable.contractId}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{installmentLabel(receivable)}</TableCell>
      <TableCell className="text-muted-foreground">{formatDueDate(receivable.dueDate)}</TableCell>
      <TableCell>{formatCurrency(receivable.amount)}</TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          disabled={pay.isPending}
          onClick={() =>
            confirm({
              title: "Baixar parcela",
              description: `Confirmar o recebimento de ${installmentLabel(receivable).toLowerCase()} (${formatCurrency(receivable.amount)}) ${contract ? `do contrato ${contract.numero}` : ""}?`,
              confirmLabel: "Confirmar baixa",
              cancelLabel: "Voltar",
              variant: "default",
              onConfirm: async () => {
                await pay.mutateAsync({ id: receivable.id, payload: {} });
              },
            })
          }
        >
          <CheckCircle2 /> Baixar
        </Button>
        {dialog}
      </TableCell>
    </TableRow>
  );
}

function ContractsTable({ contracts }: { contracts: ContractWithTotals[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contrato</TableHead>
          <TableHead>Progresso</TableHead>
          <TableHead>Próxima parcela</TableHead>
          <TableHead className="text-right">Detalhe</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((c) => {
          const total = Number(c.total);
          const paid = Number(c.paid);
          const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
          return (
            <TableRow key={c.contractId}>
              <TableCell>
                <p className="text-sm font-medium">{c.numero}</p>
                <p className="text-xs text-muted-foreground">{c.companyName}</p>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={pct} className="max-w-32" />
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatCurrency(c.paid)} / {formatCurrency(c.total)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.nextDueDate ? formatDueDate(c.nextDueDate) : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/contracts/${c.contractId}`}>Ver contrato</Link>
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function ReceivablesPage() {
  const [month, setMonth] = useState(currentMonth());

  const summary = useReceivablesSummary(month);
  const contracts = useReceivableContracts();

  const contractById = useMemo(() => {
    const map = new Map<string, ContractWithTotals>();
    for (const c of contracts.data ?? []) map.set(c.contractId, c);
    return map;
  }, [contracts.data]);

  const isLoading = summary.isLoading || contracts.isLoading;
  const isError = summary.isError || contracts.isError;
  const noPlans = !isLoading && !isError && (contracts.data?.length ?? 0) === 0;

  const overdueCount = summary.data?.overdueItems.length ?? 0;
  const overdueTotal = Number(summary.data?.overdue ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">A Receber</h1>
          <p className="text-sm text-muted-foreground">
            Parcelas e entradas dos contratos, vencidas e por vencer.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="receivables-month" className="text-xs text-muted-foreground">
            Mês de referência
          </Label>
          <Input
            id="receivables-month"
            type="month"
            className="w-40"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="A receber no mês"
          value={formatCurrency(summary.data?.toReceive ?? 0)}
          icon={HandCoins}
          loading={summary.isLoading}
        />
        <StatCard
          label={overdueCount > 0 ? `Vencidas (${overdueCount})` : "Vencidas"}
          value={formatCurrency(overdueTotal)}
          icon={AlertTriangle}
          loading={summary.isLoading}
          accent={overdueTotal > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Recebido no mês"
          value={formatCurrency(summary.data?.received ?? 0)}
          icon={Wallet}
          loading={summary.isLoading}
          accent="success"
        />
      </div>

      {isError ? (
        <ErrorState
          onRetry={() => {
            summary.refetch();
            contracts.refetch();
          }}
        />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : noPlans ? (
        <EmptyState
          icon={HandCoins}
          title="Nenhum plano de recebimento ainda"
          description="Defina no detalhe de um contrato assinado."
          className="py-20"
        />
      ) : (
        <>
          {overdueCount > 0 && (
            <Card className="border-destructive/40">
              <CardHeader>
                <CardTitle className="text-destructive">Vencidas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contrato</TableHead>
                      <TableHead>Parcela</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(summary.data?.overdueItems ?? []).map((r) => (
                      <OverdueRow key={r.id} receivable={r} contract={contractById.get(r.contractId)} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <CardHeader className="p-4 pb-0">
              <CardTitle>Por contrato</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              <ContractsTable contracts={contracts.data ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
