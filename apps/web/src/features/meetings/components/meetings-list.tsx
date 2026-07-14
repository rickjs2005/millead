"use client";

import {
  Ban,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  UserX,
  Users,
  Video,
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EditMeetingDialog } from "@/features/meetings/components/edit-meeting-dialog";
import { MeetingAttendeesDialog } from "@/features/meetings/components/meeting-attendees-dialog";
import { useUpdateMeeting } from "@/features/meetings/hooks";
import {
  MEETING_LOCATION_LABELS,
  MEETING_STATUS_LABELS,
  MEETING_STATUS_VARIANT,
} from "@/features/meetings/meeting-labels";
import { formatDateTime } from "@/utils/format";
import type { Meeting } from "@/types/api";

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const [editOpen, setEditOpen] = useState(false);
  const [attendeesOpen, setAttendeesOpen] = useState(false);
  const updateMeeting = useUpdateMeeting(meeting.id);
  const { confirm, dialog } = useConfirmDialog();

  const isScheduled = meeting.status === "SCHEDULED";

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">{meeting.title}</p>
          <div className="flex items-center gap-1">
            <Badge variant={MEETING_STATUS_VARIANT[meeting.status]}>
              {MEETING_STATUS_LABELS[meeting.status]}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Editar / reagendar
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setAttendeesOpen(true)}>
                  <Users /> Participantes
                </DropdownMenuItem>
                {isScheduled && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => updateMeeting.mutate({ status: "COMPLETED" })}
                    >
                      <CheckCircle2 /> Marcar como concluída
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => updateMeeting.mutate({ status: "NO_SHOW" })}>
                      <UserX /> Não compareceu
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() =>
                        confirm({
                          title: "Cancelar reunião",
                          description: `Cancelar "${meeting.title}"? Os participantes não são avisados automaticamente.`,
                          confirmLabel: "Cancelar reunião",
                          cancelLabel: "Voltar",
                          onConfirm: async () => {
                            await updateMeeting.mutateAsync({ status: "CANCELED" });
                          },
                        })
                      }
                    >
                      <Ban /> Cancelar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{formatDateTime(meeting.scheduledAt)}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{MEETING_LOCATION_LABELS[meeting.location]}</span>
          <span>·</span>
          <span>{meeting.durationMinutes} min</span>
        </div>
        {meeting.meetingUrl && (
          <a
            href={meeting.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-primary hover:underline"
          >
            Entrar na reunião
          </a>
        )}
      </CardContent>

      {/* key força o form a recarregar os defaults quando a reunião muda */}
      {editOpen && (
        <EditMeetingDialog
          key={meeting.updatedAt}
          meeting={meeting}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {attendeesOpen && (
        <MeetingAttendeesDialog
          meetingId={meeting.id}
          open={attendeesOpen}
          onOpenChange={setAttendeesOpen}
        />
      )}
      {dialog}
    </Card>
  );
}

export function MeetingsList({ meetings, isLoading }: { meetings: Meeting[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return <EmptyState icon={Video} title="Nenhuma reunião encontrada" className="py-16" />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {meetings.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} />
      ))}
    </div>
  );
}
