"use client";

import { ArrowLeft, Building2, Mail, MapPin, Pencil, Phone, Trash2, Users2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CompanyAuditCard } from "@/features/audit/components/company-audit-card";
import { CompanyFormDialog } from "@/features/companies/components/company-form-dialog";
import { CompanySocialsCard } from "@/features/companies/components/company-socials-card";
import { CompanyWebsitesCard } from "@/features/companies/components/company-websites-card";
import { useCompany, useDeleteCompany } from "@/features/companies/hooks";
import { formatDate } from "@/utils/format";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: company, isLoading } = useCompany(id);
  const deleteCompany = useDeleteCompany();
  const { confirm, dialog } = useConfirmDialog();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!company) {
    return <EmptyState icon={Building2} title="Empresa não encontrada" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/companies"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Empresas
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{company.name}</h1>
              <p className="text-sm text-muted-foreground">
                {company.segment ?? "Sem segmento"} · cadastrada em {formatDate(company.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/leads?companyId=${company.id}`}>
                <Users2 /> Ver leads
              </Link>
            </Button>
            <CompanyFormDialog
              key={company.updatedAt}
              company={company}
              trigger={
                <Button>
                  <Pencil /> Editar
                </Button>
              }
            />
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() =>
                confirm({
                  title: "Excluir empresa",
                  description: `Excluir "${company.name}"? Essa ação não pode ser desfeita. Se houver contratos vinculados, resolva-os antes.`,
                  confirmLabel: "Excluir",
                  onConfirm: async () => {
                    await deleteCompany.mutateAsync(company.id);
                    router.push("/companies");
                  },
                })
              }
            >
              <Trash2 /> Excluir
            </Button>
          </div>
        </div>
        {dialog}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 text-sm">
              {company.document && (
                <p>
                  <span className="text-muted-foreground">CNPJ:</span> {company.document}
                </p>
              )}
              {company.sizeEstimate && (
                <p>
                  <span className="text-muted-foreground">Porte:</span> {company.sizeEstimate}
                </p>
              )}
              {(company.city || company.state) && (
                <p className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {[company.city, company.state].filter(Boolean).join(", ")}
                </p>
              )}
              {company.phone && (
                <p className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {company.phone}
                </p>
              )}
              {company.email && (
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" /> {company.email}
                </p>
              )}
              {!company.document &&
                !company.sizeEstimate &&
                !company.city &&
                !company.state &&
                !company.phone &&
                !company.email && (
                  <p className="text-muted-foreground">
                    Nenhum dado cadastrado ainda — use “Editar” pra completar o perfil.
                  </p>
                )}
              {company.notes && (
                <div className="mt-2 rounded-lg bg-muted/50 p-3">
                  <p className="whitespace-pre-wrap text-sm">{company.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <CompanyWebsitesCard companyId={company.id} websites={company.websites} />
          <CompanySocialsCard companyId={company.id} socials={company.socials} />
          <CompanyAuditCard companyId={company.id} hasWebsite={company.websites.length > 0} />
        </div>
      </div>
    </div>
  );
}
