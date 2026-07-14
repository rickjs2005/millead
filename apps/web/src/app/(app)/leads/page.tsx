"use client";

import { Download, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { CreateLeadDialog } from "@/features/leads/components/create-lead-dialog";
import { LeadFilters } from "@/features/leads/components/lead-filters";
import { LeadsTable } from "@/features/leads/components/leads-table";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-labels";
import { useLeads } from "@/features/leads/hooks";
import { usePipelines } from "@/features/pipeline/hooks";
import { useDebounce } from "@/hooks/use-debounce";
import { exportToCsv } from "@/utils/csv-export";
import { formatCurrency, formatDate } from "@/utils/format";
import type { LeadStatus } from "@/types/api";

export default function LeadsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LeadStatus | "ALL">("ALL");
  const [stageId, setStageId] = useState<string | "ALL">("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const debouncedSearch = useDebounce(search, 350);

  const { data: pipelines } = usePipelines();
  const defaultPipeline = pipelines?.find((p) => p.isDefault) ?? pipelines?.[0];
  const stagesById = useMemo(() => {
    const map = new Map();
    for (const pipeline of pipelines ?? []) {
      for (const stage of pipeline.stages) map.set(stage.id, stage);
    }
    return map;
  }, [pipelines]);

  const { data, isLoading, isError, refetch } = useLeads({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
    status: status === "ALL" ? undefined : status,
    pipelineStageId: stageId === "ALL" ? undefined : stageId,
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (!data) return prev;
      const allSelected = data.items.every((l) => prev.has(l.id));
      return allSelected ? new Set() : new Set(data.items.map((l) => l.id));
    });
  }

  function handleExport() {
    if (!data) return;
    const rows = data.items
      .filter((l) => selected.size === 0 || selected.has(l.id))
      .map((lead) => ({
        Título: lead.title,
        Status: LEAD_STATUS_LABELS[lead.status],
        Valor: formatCurrency(lead.value, lead.currency),
        Origem: lead.source,
        "Criado em": formatDate(lead.createdAt),
      }));
    exportToCsv(`leads-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} lead${data.total === 1 ? "" : "s"} no total` : "Carregando…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={!data || data.items.length === 0}
          >
            <Download /> Exportar{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
          <CreateLeadDialog />
        </div>
      </div>

      <Card className="p-4">
        <LeadFilters
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          status={status}
          onStatusChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          stageId={stageId}
          onStageChange={(v) => {
            setStageId(v);
            setPage(1);
          }}
          pipeline={defaultPipeline}
        />
      </Card>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <span>
            <span className="font-medium">{selected.size}</span> selecionado
            {selected.size === 1 ? "" : "s"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            className="gap-1"
          >
            <X className="h-3.5 w-3.5" /> Limpar seleção
          </Button>
        </div>
      )}

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Card className="overflow-hidden p-0">
          <LeadsTable
            leads={data?.items ?? []}
            isLoading={isLoading}
            stagesById={stagesById}
            selected={selected}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
          />
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
