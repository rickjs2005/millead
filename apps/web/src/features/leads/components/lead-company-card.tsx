"use client";

import { Building2, Globe, Instagram, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/features/companies/hooks";

export function LeadCompanyCard({ companyId }: { companyId: string | null }) {
  const { data: company, isLoading } = useCompany(companyId ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa</CardTitle>
      </CardHeader>
      <CardContent>
        {!companyId ? (
          <EmptyState
            icon={Building2}
            title="Nenhuma empresa vinculada"
            description="Edite o lead para associar uma empresa."
            className="border-none py-8"
          />
        ) : isLoading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : company ? (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">{company.name}</p>
              {company.segment && (
                <p className="text-xs text-muted-foreground">{company.segment}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              {(company.city || company.state) && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />{" "}
                  {[company.city, company.state].filter(Boolean).join(", ")}
                </p>
              )}
              {company.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> {company.phone}
                </p>
              )}
              {company.email && (
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {company.email}
                </p>
              )}
            </div>
            {company.websites.length > 0 && (
              <div className="flex flex-col gap-1">
                {company.websites.map((site) => (
                  <a
                    key={site.id}
                    href={site.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" /> {site.url}
                  </a>
                ))}
              </div>
            )}
            {company.socials.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {company.socials.map((social) => (
                  <Badge key={social.id} variant="secondary" className="gap-1">
                    <Instagram className="h-3 w-3" /> {social.handleOrUrl}
                  </Badge>
                ))}
              </div>
            )}
            <Link
              href={`/leads?companyId=${company.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              Ver outros leads desta empresa
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
