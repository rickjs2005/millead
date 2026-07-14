"use client";

import { MonthCalendar } from "@/features/agenda/components/month-calendar";
import { WeekCalendar } from "@/features/agenda/components/week-calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AgendaPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
        <p className="text-sm text-muted-foreground">
          Reuniões e tarefas com vencimento em um só lugar.
        </p>
      </div>

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">Mês</TabsTrigger>
          <TabsTrigger value="week">Semana</TabsTrigger>
        </TabsList>
        <TabsContent value="month">
          <MonthCalendar />
        </TabsContent>
        <TabsContent value="week">
          <WeekCalendar />
        </TabsContent>
      </Tabs>
    </div>
  );
}
