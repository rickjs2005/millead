"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { CompaniesList } from "@/features/companies/components/companies-list";
import { CompanyFormDialog } from "@/features/companies/components/company-form-dialog";
import { useCompanies } from "@/features/companies/hooks";
import { useDebounce } from "@/hooks/use-debounce";

export default function CompaniesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading, isError, refetch } = useCompanies({
    page,
    pageSize: 20,
    search: debouncedSearch || undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.total} empresa${data.total === 1 ? "" : "s"}` : "Carregando…"}
          </p>
        </div>
        <CompanyFormDialog
          trigger={
            <Button>
              <Plus /> Nova empresa
            </Button>
          }
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome…"
          className="pl-9"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Card className="p-4">
          <CompaniesList companies={data?.items ?? []} isLoading={isLoading} />
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
