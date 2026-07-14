"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditCard } from "@/features/audit/components/audit-card";
import { useAudits, useRequestAudit } from "@/features/audit/hooks";

/**
 * Última auditoria da empresa + botão de auditar agora -- usado no detalhe
 * da empresa e na aba Auditoria do lead.
 */
export function CompanyAuditCard({
  companyId,
  hasWebsite,
}: {
  companyId: string;
  hasWebsite: boolean;
}) {
  const { data, isLoading } = useAudits({ companyId, pageSize: 1 });
  const requestAudit = useRequestAudit();
  const latest = data?.items[0];
  const pending = latest && (latest.status === "QUEUED" || latest.status === "RUNNING");

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Auditoria do site</CardTitle>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasWebsite || requestAudit.isPending || !!pending}
          onClick={() => requestAudit.mutate(companyId)}
          title={hasWebsite ? undefined : "Cadastre um site na empresa antes de auditar."}
        >
          <ShieldCheck /> {pending ? "Analisando…" : "Auditar agora"}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !latest ? (
          <p className="text-sm text-muted-foreground">
            {hasWebsite
              ? "Nenhuma auditoria ainda — clique em “Auditar agora” pra gerar a primeira."
              : "A empresa não tem site cadastrado; adicione um site pra habilitar a auditoria."}
          </p>
        ) : (
          <>
            <AuditCard audit={latest} hideCompany />
            {data && data.total > 1 && (
              <Link
                href="/audit"
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver histórico completo ({data.total})
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
