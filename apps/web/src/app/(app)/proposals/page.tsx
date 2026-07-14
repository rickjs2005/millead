"use client";

import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateProposalDialog } from "@/features/proposals/components/create-proposal-dialog";
import { ProposalsList } from "@/features/proposals/components/proposals-list";
import { useProposals } from "@/features/proposals/hooks";
import { PROPOSAL_STATUS_LABELS } from "@/features/proposals/proposal-labels";
import type { ProposalStatus } from "@/types/api";

export default function ProposalsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProposalStatus | "ALL">("ALL");

  const { data, isLoading, isError, refetch } = useProposals({
    page,
    pageSize: 20,
    status: status === "ALL" ? undefined : status,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Propostas</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} proposta${data.total === 1 ? "" : "s"}` : "Carregando…"}
          </p>
        </div>
        <CreateProposalDialog />
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as ProposalStatus | "ALL");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os status</SelectItem>
          {Object.entries(PROPOSAL_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Card className="overflow-hidden p-0">
          <ProposalsList proposals={data?.items ?? []} isLoading={isLoading} />
        </Card>
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
