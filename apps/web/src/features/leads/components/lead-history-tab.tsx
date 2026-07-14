"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVITY_ICON, describeActivity } from "@/features/leads/activity-labels";
import { useLeadActivities } from "@/features/leads/hooks";
import { formatDateTime } from "@/utils/format";

export function LeadHistoryTab({ leadId }: { leadId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useLeadActivities(leadId, page);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Nenhuma atividade registrada ainda"
        className="border-none py-12"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="relative flex flex-col gap-5 border-l border-border pl-6">
        {data.items.map((activity) => {
          const Icon = ACTIVITY_ICON[activity.type];
          return (
            <li key={activity.id} className="relative">
              <span className="absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </span>
              <p className="text-sm">{describeActivity(activity)}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
            </li>
          );
        })}
      </ol>
      {data.total > data.pageSize && (
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
