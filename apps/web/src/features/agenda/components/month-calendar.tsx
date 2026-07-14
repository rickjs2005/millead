"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, CheckSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Meeting, Task } from "@/types/api";
import { cn } from "@/lib/utils";
import { useMonthMeetings, usePendingTasksForCalendar } from "../hooks";
import { AgendaDayPanel } from "./agenda-day-panel";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function MonthCalendar() {
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd],
  );

  const {
    data: meetings,
    isLoading: meetingsLoading,
    isError: meetingsError,
    refetch: refetchMeetings,
  } = useMonthMeetings(gridStart.toISOString(), gridEnd.toISOString());
  const {
    data: tasksPage,
    isLoading: tasksLoading,
    isError: tasksError,
    refetch: refetchTasks,
  } = usePendingTasksForCalendar();

  const meetingsByDay = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    for (const meeting of meetings?.items ?? []) {
      const key = format(new Date(meeting.scheduledAt), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(meeting);
      map.set(key, list);
    }
    return map;
  }, [meetings]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasksPage?.items ?? []) {
      if (!task.dueAt) continue;
      const key = format(new Date(task.dueAt), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasksPage]);

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
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="flex-1">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold capitalize">
            {format(cursor, "MMMM yyyy", { locale: ptBR })}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => subMonths(c, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCursor((c) => addMonths(c, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="bg-muted/50 py-2 text-center text-xs font-medium text-muted-foreground"
            >
              {label}
            </div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayMeetings = meetingsByDay.get(key) ?? [];
            const dayTasks = tasksByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, cursor);
            const selected = isSameDay(day, selectedDay);

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  "flex min-h-20 flex-col gap-1 bg-card p-1.5 text-left transition-colors hover:bg-accent sm:min-h-24",
                  !inMonth && "bg-muted/20 text-muted-foreground/50",
                  selected && "ring-2 ring-inset ring-primary",
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    isToday(day) && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
                {isLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {dayMeetings.length > 0 && (
                      <span className="flex items-center gap-0.5 rounded bg-primary/10 px-1 text-[10px] text-primary">
                        <CalendarCheck className="h-2.5 w-2.5" /> {dayMeetings.length}
                      </span>
                    )}
                    {dayTasks.length > 0 && (
                      <span className="flex items-center gap-0.5 rounded bg-warning/10 px-1 text-[10px] text-warning">
                        <CheckSquare className="h-2.5 w-2.5" /> {dayTasks.length}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AgendaDayPanel
        day={selectedDay}
        meetings={meetingsByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []}
        tasks={tasksByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []}
      />
    </div>
  );
}
