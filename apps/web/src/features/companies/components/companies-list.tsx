"use client";

import { Building2, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Company } from "@/types/api";

function CompanyRow({ company }: { company: Company }) {
  return (
    <Link
      href={`/companies/${company.id}`}
      className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{company.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {(company.city || company.state) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[company.city, company.state].filter(Boolean).join(", ")}
            </span>
          )}
          {company.phone && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {company.phone}
            </span>
          )}
          {company.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {company.email}
            </span>
          )}
        </div>
      </div>
      {company.segment && <Badge variant="secondary">{company.segment}</Badge>}
    </Link>
  );
}

export function CompaniesList({
  companies,
  isLoading,
}: {
  companies: Company[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (companies.length === 0) {
    return <EmptyState icon={Building2} title="Nenhuma empresa encontrada" className="py-16" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {companies.map((company) => (
        <CompanyRow key={company.id} company={company} />
      ))}
    </div>
  );
}
