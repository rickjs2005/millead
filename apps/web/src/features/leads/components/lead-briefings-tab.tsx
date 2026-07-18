"use client";

import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BRIEFING_STATUS_LABELS, BRIEFING_STATUS_VARIANT } from "@/features/briefings/briefing-labels";
import { useBriefings } from "@/features/briefings/hooks";
import { formatDate } from "@/utils/format";

export function LeadBriefingsTab({ leadId }: { leadId: string }) {
  const { data, isLoading } = useBriefings({ leadId, pageSize: 20 });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum briefing enviado"
        description="Crie um briefing pra este lead na tela de Briefings, vinculando-o na criação."
        className="py-16"
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.items.map((briefing) => (
        <Link
          key={briefing.id}
          href={`/briefings/${briefing.id}`}
          className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {briefing.contactName ?? "Sem nome ainda"}
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(briefing.createdAt)}</p>
          </div>
          <div className="hidden w-28 flex-col gap-1 sm:flex">
            <Progress value={briefing.progressPercent} />
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {briefing.progressPercent}%
            </span>
          </div>
          <Badge variant={BRIEFING_STATUS_VARIANT[briefing.status]}>
            {BRIEFING_STATUS_LABELS[briefing.status]}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
