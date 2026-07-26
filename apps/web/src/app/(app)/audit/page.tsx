"use client";

import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useCompany } from "@/features/companies/hooks";
import type { AuditStatus } from "@/types/api";

/**
 * Dois modos na mesma rota:
 * - sem `companyId`: a última auditoria de CADA empresa (visão de lista);
 * - com `companyId`: o histórico completo daquela empresa.
 */
export default function AuditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId") ?? undefined;
  const isHistory = !!companyId;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AuditStatus | "ALL">("ALL");

  const { data: company } = useCompany(companyId);
  const { data, isLoading, isError, refetch } = useAudits({
    page,
    pageSize: 12,
    status: status === "ALL" ? undefined : status,
    companyId,
    latestPerCompany: !companyId,
  });

  const subtitle = !data
    ? "Performance, SEO, acessibilidade, segurança, mobile e design."
    : isHistory
      ? `${data.total} auditoria${data.total === 1 ? "" : "s"} desta empresa`
      : `${data.total} empresa${data.total === 1 ? "" : "s"} auditada${data.total === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {isHistory && (
            <button
              type="button"
              onClick={() => {
                setPage(1);
                router.push("/audit");
              }}
              className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" /> Todas as empresas
            </button>
          )}
          <h1 className="text-2xl font-semibold tracking-tight">
            {isHistory ? `Histórico — ${company?.name ?? "…"}` : "Auditoria de sites"}
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
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
          title={isHistory ? "Nenhuma auditoria com esse filtro" : "Nenhuma auditoria ainda"}
          description={
            isHistory
              ? "Troque o status ou volte para a lista de empresas."
              : "Solicite a primeira: escolha uma empresa com site cadastrado e receba as notas em instantes."
          }
          className="py-24"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.items.map((audit) => (
            <AuditCard
              key={audit.id}
              audit={audit}
              hideCompany={isHistory}
              historyHref={isHistory ? undefined : `/audit?companyId=${audit.companyId}`}
            />
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
