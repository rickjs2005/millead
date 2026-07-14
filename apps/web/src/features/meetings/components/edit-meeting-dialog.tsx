"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEETING_LOCATION_LABELS } from "@/features/meetings/meeting-labels";
import { useUpdateMeeting } from "@/features/meetings/hooks";
import type { Meeting, MeetingLocation } from "@/types/api";

/** ISO -> valor aceito por <input type="datetime-local"> (no fuso local). */
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const schema = z.object({
  title: z.string().min(1, "Informe um título."),
  scheduledAt: z.string().min(1, "Informe data e hora."),
  durationMinutes: z.coerce.number().int().min(5, "Mínimo de 5 minutos."),
  location: z.enum(["ONLINE", "IN_PERSON", "PHONE"]),
  meetingUrl: z.string().url("URL inválida.").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

export function EditMeetingDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: Meeting;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateMeeting = useUpdateMeeting(meeting.id);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: meeting.title,
      scheduledAt: toDateTimeLocal(meeting.scheduledAt),
      durationMinutes: meeting.durationMinutes,
      location: meeting.location,
      meetingUrl: meeting.meetingUrl ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    await updateMeeting.mutateAsync({
      title: values.title,
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      durationMinutes: values.durationMinutes,
      location: values.location,
      meetingUrl: values.meetingUrl === "" ? null : values.meetingUrl,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Editar reunião</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-title">Título</Label>
              <Input id="meeting-title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="meeting-scheduled-at">Data e hora</Label>
                <Input
                  id="meeting-scheduled-at"
                  type="datetime-local"
                  {...register("scheduledAt")}
                />
                {errors.scheduledAt && (
                  <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="meeting-duration">Duração (min)</Label>
                <Input
                  id="meeting-duration"
                  type="number"
                  min={5}
                  step={5}
                  {...register("durationMinutes")}
                />
                {errors.durationMinutes && (
                  <p className="text-xs text-destructive">{errors.durationMinutes.message}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Formato</Label>
              <Controller
                control={control}
                name="location"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as MeetingLocation)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEETING_LOCATION_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="meeting-url">Link da reunião</Label>
              <Input id="meeting-url" placeholder="https://…" {...register("meetingUrl")} />
              {errors.meetingUrl && (
                <p className="text-xs text-destructive">{errors.meetingUrl.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMeeting.isPending}>
              {updateMeeting.isPending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
