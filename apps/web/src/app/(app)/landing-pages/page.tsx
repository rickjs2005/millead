"use client";

import { Rocket } from "lucide-react";
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
import { CreateLandingPageDialog } from "@/features/landing-pages/components/create-landing-page-dialog";
import { LandingPageCard } from "@/features/landing-pages/components/landing-page-card";
import { useLandingPages } from "@/features/landing-pages/hooks";
import { LANDING_PAGE_STATUS_LABELS } from "@/features/landing-pages/landing-page-labels";
import type { LandingPageStatus } from "@/types/api";

export default function LandingPagesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<LandingPageStatus | "ALL">("ALL");

  const { data, isLoading, isError, refetch } = useLandingPages({
    page,
    pageSize: 10,
    status: status === "ALL" ? undefined : status,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Landing pages</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? `${data.total} página${data.total === 1 ? "" : "s"}`
              : "Páginas geradas por IA pra impressionar prospects."}
          </p>
        </div>
        <CreateLandingPageDialog />
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as LandingPageStatus | "ALL");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os status</SelectItem>
          {Object.entries(LANDING_PAGE_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="Nenhuma landing page ainda"
          description="Gere a primeira: escolha uma empresa e a IA cria uma página completa pra você mostrar ao prospect."
          className="py-24"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {data.items.map((lp) => (
            <LandingPageCard key={lp.id} page={lp} />
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
