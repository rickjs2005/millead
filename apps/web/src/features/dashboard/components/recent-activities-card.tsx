"use client";

import { History } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVITY_ICON, describeActivity } from "@/features/leads/activity-labels";
import { formatDateTime } from "@/utils/format";
import { useAuthStore } from "@/stores/auth-store";
import { useRecentActivities } from "../hooks";

/**
 * Feed compacto igual ao do sino de notificações (components/shell/
 * notifications-bell.tsx) -- mesma queryKey, então reaproveita o cache em
 * vez de duplicar a chamada. Sem nome do lead no card: `Activity` só traz
 * `leadId` (o backend não faz join com o título do lead nessa listagem),
 * então "qual lead" fica só no link, igual o sino já faz hoje.
 */
export function RecentActivitiesCard() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canRead = hasPermission("leads:read");

  const { data: activities, isLoading } = useRecentActivities({ enabled: canRead });

  if (!canRead) return null;

  const items = (activities ?? []).slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atividades recentes</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nenhuma atividade recente"
            className="border-none py-8"
          />
        ) : (
          items.map((activity) => {
            const Icon = ACTIVITY_ICON[activity.type];
            const content = (
              <div className="flex items-start gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{describeActivity(activity)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            );
            return activity.leadId ? (
              <Link key={activity.id} href={`/leads/${activity.leadId}`}>
                {content}
              </Link>
            ) : (
              <div key={activity.id}>{content}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
