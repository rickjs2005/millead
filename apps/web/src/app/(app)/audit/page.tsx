"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AUDIT_STATUS_LABELS } from "@/features/audit/audit-labels";
import { AuditCard } from "@/features/audit/components/audit-card";
import { RequestAuditDialog } from "@/features/audit/components/request-audit-dialog";
import { useAudits } from "@/features/audit/hooks";
import type { AuditStatus } from "@/types/api";

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AuditStatus | "ALL">("ALL");

  const { data, isLoading, isError, refetch } = useAudits({
    page,
    pageSize: 12,
    status: status === "ALL" ? undefined : status,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Auditoria de sites</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.total} auditoria${data.total === 1 ? "" : "s"}`
              : "Performance, SEO, acessibilidade, segurança, mobile e design."}
          </p>
        </div>
        <RequestAuditDialog />
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as AuditStatus | "ALL");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os status</SelectItem>
          {Object.entries(AUDIT_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nenhuma auditoria ainda"
          description="Solicite a primeira: escolha uma empresa com site cadastrado e receba as notas em instantes."
          className="py-24"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.items.map((audit) => (
            <AuditCard key={audit.id} audit={audit} />
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
