"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstimatesList } from "@/features/estimates/components/estimates-list";
import { ESTIMATE_STATUS_LABELS } from "@/features/estimates/estimate-labels";
import { useEstimateProducts, useEstimates } from "@/features/estimates/hooks";
import type { EstimateStatus } from "@/types/api";

const PAGE_SIZE = 20;

export default function EstimatesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EstimateStatus | "ALL">("ALL");

  const { data, isLoading, isError, refetch } = useEstimates({
    page,
    pageSize: PAGE_SIZE,
    status: status === "ALL" ? undefined : status,
  });
  const { data: products } = useEstimateProducts();

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} orçamento${data.total === 1 ? "" : "s"}` : "Carregando…"}
          </p>
        </div>
        <Button asChild>
          <Link href="/estimates/new">
            <Plus /> Novo orçamento
          </Link>
        </Button>
      </div>

      <Select
        value={status}
        onValueChange={(v) => {
          setStatus(v as EstimateStatus | "ALL");
          setPage(1);
        }}
      >
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos os status</SelectItem>
          {Object.entries(ESTIMATE_STATUS_LABELS).map(([value, label]) => (
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
          <EstimatesList
            estimates={data?.items ?? []}
            products={products ?? []}
            isLoading={isLoading}
          />
        </Card>
      )}

      {data && data.total > 0 && (
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
