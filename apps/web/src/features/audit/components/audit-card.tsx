"use client";

import { FileSearch, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AUDIT_STATUS_LABELS,
  AUDIT_STATUS_VARIANT,
  overallScore,
  scoreColorClass,
} from "@/features/audit/audit-labels";
import { AuditReportDialog } from "@/features/audit/components/audit-report-dialog";
import { AuditScoresRow } from "@/features/audit/components/audit-scores-row";
import { useCompany } from "@/features/companies/hooks";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { Audit } from "@/types/api";

export function AuditCard({ audit, hideCompany }: { audit: Audit; hideCompany?: boolean }) {
  const { data: company } = useCompany(hideCompany ? undefined : audit.companyId);
  const overall = overallScore(audit.scores);
  const pending = audit.status === "QUEUED" || audit.status === "RUNNING";

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {!hideCompany && (
              <Link
                href={`/companies/${audit.companyId}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {company?.name ?? "…"}
              </Link>
            )}
            <p className="text-xs text-muted-foreground">
              Solicitada em {formatDateTime(audit.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overall !== null && (
              <span className={cn("text-2xl font-bold tabular-nums", scoreColorClass(overall))}>
                {overall}
              </span>
            )}
            <Badge variant={AUDIT_STATUS_VARIANT[audit.status]} className="gap-1">
              {pending && <Loader2 className="h-3 w-3 animate-spin" />}
              {AUDIT_STATUS_LABELS[audit.status]}
            </Badge>
          </div>
        </div>

        {audit.status === "COMPLETED" && (
          <>
            <AuditScoresRow scores={audit.scores} compact />
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs text-muted-foreground">{audit.report?.summary}</p>
              <AuditReportDialog
                audit={audit}
                trigger={
                  <Button variant="outline" size="sm" className="shrink-0">
                    <FileSearch /> Ver relatório
                  </Button>
                }
              />
            </div>
          </>
        )}

        {audit.status === "FAILED" && (
          <p className="text-sm text-destructive">{audit.report?.summary ?? "A análise falhou."}</p>
        )}
      </CardContent>
    </Card>
  );
}
