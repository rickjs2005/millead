"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AUDIT_CATEGORY_ICONS,
  AUDIT_CATEGORY_LABELS,
  AUDIT_CATEGORY_ORDER,
  scoreColorClass,
} from "@/features/audit/audit-labels";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/utils/format";
import type { Audit } from "@/types/api";

/** Relatório completo: cada categoria com a lista de checagens ✓/✗. */
export function AuditReportDialog({ audit, trigger }: { audit: Audit; trigger: ReactNode }) {
  const byCategory = new Map(audit.scores.map((s) => [s.category, s]));

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatório da auditoria</DialogTitle>
          <DialogDescription>
            {audit.report?.summary ?? "Sem resumo."}{" "}
            {audit.completedAt && `Concluída em ${formatDateTime(audit.completedAt)}.`}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65dvh] pr-3">
          <div className="flex flex-col gap-5 py-2">
            {AUDIT_CATEGORY_ORDER.map((category) => {
              const score = byCategory.get(category);
              if (!score) return null;
              const Icon = AUDIT_CATEGORY_ICONS[category];
              const checks = score.details?.checks ?? [];
              return (
                <div key={category} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">{AUDIT_CATEGORY_LABELS[category]}</h3>
                    <Badge
                      variant="outline"
                      className={cn("ml-auto tabular-nums", scoreColorClass(score.score))}
                    >
                      {score.score}/100
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    {checks.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm odd:bg-muted/40"
                      >
                        {check.passed ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                        ) : (
                          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        )}
                        <span className="flex-1">{check.label}</span>
                        {check.info && (
                          <span className="text-xs text-muted-foreground">{check.info}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
