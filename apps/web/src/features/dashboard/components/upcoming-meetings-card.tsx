"use client";

import { Video } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/utils/format";
import { useUpcomingMeetings } from "../hooks";

export function UpcomingMeetingsCard() {
  const { data, isLoading } = useUpcomingMeetings();

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Próximas reuniões</CardTitle>
        <Link href="/meetings" className="text-xs font-medium text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
        ) : !data || data.items.length === 0 ? (
          <EmptyState icon={Video} title="Nenhuma reunião agendada" className="border-none py-8" />
        ) : (
          data.items.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent"
            >
              <p className="truncate text-sm">{meeting.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDateTime(meeting.scheduledAt)}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
