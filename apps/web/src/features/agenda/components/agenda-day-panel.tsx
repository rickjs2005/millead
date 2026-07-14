import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MEETING_STATUS_VARIANT } from "@/features/meetings/meeting-labels";
import type { Meeting, Task } from "@/types/api";

export function AgendaDayPanel({
  day,
  meetings,
  tasks,
}: {
  day: Date;
  meetings: Meeting[];
  tasks: Task[];
}) {
  const hasEvents = meetings.length > 0 || tasks.length > 0;

  return (
    <Card className="w-full lg:w-80">
      <CardHeader>
        <CardTitle className="capitalize">
          {format(day, "EEEE, d 'de' MMMM", { locale: ptBR })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!hasEvents ? (
          <EmptyState icon={CalendarX} title="Nada agendado" className="border-none py-8" />
        ) : (
          <>
            {meetings.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Reuniões</p>
                {meetings.map((meeting) => (
                  <div key={meeting.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{meeting.title}</p>
                      <Badge variant={MEETING_STATUS_VARIANT[meeting.status]} className="shrink-0">
                        {format(new Date(meeting.scheduledAt), "HH:mm")}
                      </Badge>
                    </div>
                    {meeting.leadId && (
                      <Link
                        href={`/leads/${meeting.leadId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Ver lead
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
            {tasks.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Tarefas</p>
                {tasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border p-2.5 text-sm">
                    {task.title}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
