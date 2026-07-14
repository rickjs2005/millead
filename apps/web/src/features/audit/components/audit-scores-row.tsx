"use client";

import {
  AUDIT_CATEGORY_ICONS,
  AUDIT_CATEGORY_LABELS,
  AUDIT_CATEGORY_ORDER,
  scoreColorClass,
} from "@/features/audit/audit-labels";
import { cn } from "@/lib/utils";
import type { AuditScore } from "@/types/api";

/** Fileira com as 6 notas por categoria (ícone + número colorido). */
export function AuditScoresRow({ scores, compact }: { scores: AuditScore[]; compact?: boolean }) {
  const byCategory = new Map(scores.map((s) => [s.category, s]));

  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6")}>
      {AUDIT_CATEGORY_ORDER.map((category) => {
        const score = byCategory.get(category);
        const Icon = AUDIT_CATEGORY_ICONS[category];
        return (
          <div
            key={category}
            className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-center"
            title={AUDIT_CATEGORY_LABELS[category]}
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span
              className={cn(
                "text-lg font-semibold tabular-nums",
                score ? scoreColorClass(score.score) : "text-muted-foreground",
              )}
            >
              {score ? score.score : "–"}
            </span>
            {!compact && (
              <span className="text-[10px] leading-tight text-muted-foreground">
                {AUDIT_CATEGORY_LABELS[category]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
