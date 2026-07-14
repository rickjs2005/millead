"use client";

import { CheckCircle2, Clock, FileSignature, Plus, Search, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractForm } from "@/features/contracts/components/contract-form";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_VARIANT,
  CONTRACT_TYPE_LABELS,
} from "@/features/contracts/contract-labels";
import { useContractKpis, useContracts, useCreateContract } from "@/features/contracts/hooks";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, formatDate } from "@/utils/format";
import type { ContractStatus, ContractType } from "@/types/api";

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Clock }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-semibold leading-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ContractsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ContractStatus | "ALL">("ALL");
  const [tipo, setTipo] = useState<ContractType | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: kpis } = useContractKpis();
  const createContract = useCreateContract();
  const { data, isLoading, isError, refetch } = useContracts({
    page,
    pageSize: 15,
    status: status === "ALL" ? undefined : status,
    tipo: tipo === "ALL" ? undefined : tipo,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Fechamento, PDF e assinatura eletrônica — migrado do milweb-contratos.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus /> Novo contrato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Novo contrato</DialogTitle>
            </DialogHeader>
            <ContractForm
              pending={createContract.isPending}
              submitLabel="Criar contrato"
              onSubmit={async (values) => {
                await createContract.mutateAsync(values);
                setCreateOpen(false);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Contratos" value={String(kpis.total)} icon={FileSignature} />
          <Kpi
            label="Aguardando assinatura"
            value={String(kpis.aguardandoAssinatura)}
            icon={Clock}
          />
          <Kpi label="Assinados" value={String(kpis.assinados)} icon={CheckCircle2} />
          <Kpi label="Valor fechado" value={formatCurrency(kpis.valorFechado)} icon={Wallet} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Número ou empresa…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as ContractStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={tipo}
          onValueChange={(v) => {
            setTipo(v as ContractType | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="Nenhum contrato ainda"
          description="Crie o primeiro pelo botão acima, ou envie o link do formulário público pro cliente preencher."
          className="py-20"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((contract) => (
            <Link
              key={contract.id}
              href={`/contracts/${contract.id}`}
              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {contract.numero}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {contract.contractorSnapshot.nomeEmpresa ?? contract.contractorSnapshot.nome}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {CONTRACT_TYPE_LABELS[contract.tipo]} · {formatDate(contract.createdAt)}
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums">
                {formatCurrency(contract.valorTotal)}
              </span>
              <Badge variant={CONTRACT_STATUS_VARIANT[contract.status]}>
                {CONTRACT_STATUS_LABELS[contract.status]}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={data.page}
          pageSize={data.pageSize}
          total={data.total}
          totalPages={data.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
