"use client";

import {
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isToday,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useMonthMeetings, usePendingTasksForCalendar } from "../hooks";

export function WeekCalendar() {
  const [cursor, setCursor] = useState(new Date());
  const weekStart = startOfWeek(cursor);
  const weekEnd = endOfWeek(cursor);
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  );

  const {
    data: meetings,
    isLoading: meetingsLoading,
    isError: meetingsError,
    refetch: refetchMeetings,
  } = useMonthMeetings(weekStart.toISOString(), weekEnd.toISOString());
  const {
    data: tasksPage,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = usePendingTasksForCalendar();
  const isLoading = meetingsLoading || tasksLoading;

  if (meetingsError || tasksError) {
    return (
      <ErrorState
        onRetry={() => {
          void refetchMeetings();
          void refetchTasks();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {format(weekStart, "d MMM", { locale: ptBR })} –{" "}
          {format(weekEnd, "d MMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => subWeeks(c, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => addWeeks(c, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayMeetings = (meetings?.items ?? []).filter(
            (m) => format(new Date(m.scheduledAt), "yyyy-MM-dd") === key,
          );
          const dayTasks = (tasksPage?.items ?? []).filter(
            (t) => t.dueAt && format(new Date(t.dueAt), "yyyy-MM-dd") === key,
          );

          return (
            <div
              key={key}
              className={cn(
                "flex flex-col gap-2 rounded-xl border border-border bg-card p-2.5",
                isToday(day) && "ring-1 ring-primary/50",
              )}
            >
              <p className="text-xs font-medium capitalize text-muted-foreground">
                {format(day, "EEE, d", { locale: ptBR })}
              </p>
              {isLoading ? (
                <Skeleton className="h-12 w-full" />
              ) : dayMeetings.length === 0 && dayTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground/50">—</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {dayMeetings.map((meeting) => (
                    <div
                      key={meeting.id}
                      className="rounded-md bg-primary/10 px-1.5 py-1 text-[11px]"
                    >
                      <span className="font-medium">
                        {format(new Date(meeting.scheduledAt), "HH:mm")}
                      </span>{" "}
                      {meeting.title}
                    </div>
                  ))}
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-1 rounded-md bg-warning/10 px-1.5 py-1 text-[11px]"
                    >
                      <Badge variant="warning" className="px-1 py-0 text-[9px]">
                        tarefa
                      </Badge>
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
