"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MonthCalendar } from "@/features/agenda/components/month-calendar";
import { WeekCalendar } from "@/features/agenda/components/week-calendar";
import { MeetingsPanel } from "@/features/meetings/components/meetings-panel";
import { TasksPanel } from "@/features/tasks/components/tasks-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VALID_TABS = ["month", "week", "tasks", "meetings"] as const;
type AgendaTab = (typeof VALID_TABS)[number];

/** Agenda absorveu Tarefas e Reuniões como tabs (auditoria de UX 07/2026):
 * eram 3 itens de menu pros mesmos 2 tipos de dado. /tasks e /meetings
 * continuam vivos como redirect pra cá. */
export default function AgendaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tab");
  const tab: AgendaTab = VALID_TABS.includes(param as AgendaTab) ? (param as AgendaTab) : "month";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Calendário, tarefas e reuniões em um só lugar.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) =>
          router.replace(v === "month" ? "/agenda" : `/agenda?tab=${v}`, { scroll: false })
        }
      >
        <TabsList>
          <TabsTrigger value="month">Mês</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="meetings">Reuniões</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <MonthCalendar />
        </TabsContent>
        <TabsContent value="week">
          <WeekCalendar />
        </TabsContent>
        <TabsContent value="tasks">
          <TasksPanel />
        </TabsContent>
        <TabsContent value="meetings">
          <MeetingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
