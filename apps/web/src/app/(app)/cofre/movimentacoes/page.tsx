"use client";

import { Receipt, Tag, Wand2 } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClassifyDialog } from "@/features/vault/components/classify-dialog";
import {
  useVaultAccounts,
  useVaultCards,
  useVaultCategories,
  useVaultTransactions,
} from "@/features/vault/finance-hooks";
import { formatVaultDate, TRANSACTION_STATUS_LABELS } from "@/features/vault/format";
import { useRunClassification } from "@/features/vault/subscription-hooks";
import type { PersonalDateBasis, PersonalTransactionStatus, VaultTransaction } from "@/types/api";
import { formatCurrency } from "@/utils/format";

/**
 * Movimentações.
 *
 * O filtro de regime (competência × caixa) fica **visível o tempo todo**, e não
 * escondido num menu: são dois números diferentes para a mesma pergunta, e uma
 * tela que não diz qual está mostrando é uma tela que engana.
 */
export default function CofreMovimentacoesPage() {
  const [status, setStatus] = useState<PersonalTransactionStatus | "">("");
  const [basis, setBasis] = useState<PersonalDateBasis>("ACCRUAL");
  const [search, setSearch] = useState("");
  const [includeTransfers, setIncludeTransfers] = useState(false);
  const [page, setPage] = useState(1);
  const [classificando, setClassificando] = useState<VaultTransaction | null>(null);

  const categories = useVaultCategories();
  const accounts = useVaultAccounts(true);
  const cards = useVaultCards(true);
  const run = useRunClassification();

  const transactions = useVaultTransactions({
    basis,
    status: status || undefined,
    search: search.trim() || undefined,
    includeTransfers,
    page,
    pageSize: 50,
  });

  const nomeCategoria = (id: string | null) => {
    if (!id) return null;
    for (const root of categories.data ?? []) {
      if (root.id === id) return root.name;
      const child = root.children.find((c) => c.id === id);
      if (child) return `${root.name} / ${child.name}`;
    }
    return null;
  };

  const nomeOrigem = (transaction: VaultTransaction) => {
    if (transaction.accountId) {
      return (accounts.data ?? []).find((a) => a.id === transaction.accountId)?.name ?? "Conta";
    }
    return (cards.data ?? []).find((c) => c.id === transaction.cardId)?.name ?? "Cartão";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="mov-regime" className="text-xs">
            Regime
          </Label>
          <Select value={basis} onValueChange={(v) => setBasis(v as PersonalDateBasis)}>
            <SelectTrigger id="mov-regime" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACCRUAL">Competência (compra)</SelectItem>
              <SelectItem value="CASH">Caixa (dinheiro saiu)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mov-status" className="text-xs">
            Situação
          </Label>
          <Select
            value={status || "ALL"}
            onValueChange={(v) => {
              setStatus(v === "ALL" ? "" : (v as PersonalTransactionStatus));
              setPage(1);
            }}
          >
            <SelectTrigger id="mov-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {Object.entries(TRANSACTION_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-40 flex-1 space-y-1.5">
          <Label htmlFor="mov-busca" className="text-xs">
            Buscar
          </Label>
          <Input
            id="mov-busca"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Descrição"
          />
        </div>

        <div className="flex items-center gap-2 pb-2">
          <Switch
            id="mov-transf"
            checked={includeTransfers}
            onCheckedChange={(checked) => {
              setIncludeTransfers(checked);
              setPage(1);
            }}
          />
          <Label htmlFor="mov-transf" className="text-xs font-normal text-muted-foreground">
            Incluir transferências
          </Label>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="mb-1"
          onClick={() => run.mutate(undefined)}
          disabled={run.isPending}
        >
          <Wand2 /> {run.isPending ? "Classificando…" : "Classificar pendentes"}
        </Button>
      </div>

      {transactions.isPending && <Skeleton className="h-64 w-full" />}

      {!transactions.isPending && (transactions.data?.items.length ?? 0) === 0 && (
        <EmptyState
          icon={Receipt}
          title="Nenhuma movimentação"
          description="Importe um extrato para começar. Transferências ficam escondidas por padrão — elas movem dinheiro entre seus bolsos, não são gasto."
        />
      )}

      {(transactions.data?.items.length ?? 0) > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.data!.items.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatVaultDate(
                        basis === "CASH" ? transaction.settlementDate : transaction.transactionDate,
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{transaction.originalDescription}</div>
                      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                        <span>{nomeOrigem(transaction)}</span>
                        {transaction.isTransfer && (
                          <Badge variant="outline" className="text-[10px]">
                            transferência
                          </Badge>
                        )}
                        {transaction.isBusiness && (
                          <Badge variant="secondary" className="text-[10px]">
                            MilWeb {formatCurrency(transaction.businessAmount)}
                          </Badge>
                        )}
                        {transaction.isReimbursable && (
                          <Badge variant="secondary" className="text-[10px]">
                            a receber {formatCurrency(transaction.reimbursableAmount)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {nomeCategoria(transaction.categoryId) ?? (
                        <Badge variant="outline" className="text-[10px]">
                          sem categoria
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm">
                      <span
                        className={transaction.direction === "IN" ? "text-emerald-600" : undefined}
                      >
                        {transaction.direction === "IN" ? "+" : "−"}
                        {formatCurrency(transaction.amountBrl)}
                      </span>
                      {transaction.personalConsumption !== transaction.amountBrl && (
                        <div className="text-xs text-muted-foreground">
                          consumo seu {formatCurrency(transaction.personalConsumption)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant={transaction.status === "PENDING" ? "default" : "ghost"}
                        onClick={() => setClassificando(transaction)}
                      >
                        <Tag /> {transaction.status === "PENDING" ? "Revisar" : "Editar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {transactions.data!.total}{" "}
              {transactions.data!.total === 1 ? "movimentação" : "movimentações"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span>
                {page} de {transactions.data!.totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= transactions.data!.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ClassifyDialog
        transaction={classificando}
        open={classificando !== null}
        onOpenChange={(open) => !open && setClassificando(null)}
      />
    </div>
  );
}
