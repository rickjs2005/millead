"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { LeadCombobox } from "@/features/leads/components/lead-combobox";
import { useCreateMeeting } from "@/features/meetings/hooks";
import { MEETING_LOCATION_LABELS } from "@/features/meetings/meeting-labels";

const schema = z.object({
  title: z.string().min(1, "Informe um título."),
  leadId: z.string().optional(),
  scheduledAt: z.string().min(1, "Informe data e hora."),
  durationMinutes: z.string().optional(),
  location: z.enum(["ONLINE", "IN_PERSON", "PHONE"]),
  meetingUrl: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/** Com `leadId`, o dialog vem pré-vinculado ao lead (o combobox some) --
 * substitui o antigo QuickMeetingDialog da tab do lead (auditoria de UX
 * 07/2026). */
export function CreateMeetingDialog({
  leadId,
  trigger,
}: {
  leadId?: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createMeeting = useCreateMeeting();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { location: "ONLINE", leadId },
  });

  async function onSubmit(values: FormValues) {
    await createMeeting.mutateAsync({
      title: values.title,
      leadId: leadId ?? values.leadId,
      scheduledAt: new Date(values.scheduledAt).toISOString(),
      durationMinutes: values.durationMinutes ? Number(values.durationMinutes) : undefined,
      location: values.location,
      meetingUrl: values.meetingUrl || undefined,
    });
    reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Nova reunião
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Nova reunião</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Título</Label>
              <Input id="title" {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            {!leadId && (
              <div className="flex flex-col gap-1.5">
                <Label>Lead vinculado</Label>
                <Controller
                  control={control}
                  name="leadId"
                  render={({ field }) => (
                    <LeadCombobox
                      value={field.value}
                      onChange={(id) => field.onChange(id)}
                      placeholder="Nenhum lead (opcional)"
                    />
                  )}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scheduledAt">Data e hora</Label>
                <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
                {errors.scheduledAt && (
                  <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="durationMinutes">Duração (min)</Label>
                <Input
                  id="durationMinutes"
                  type="number"
                  placeholder="30"
                  {...register("durationMinutes")}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Local</Label>
                <Controller
                  control={control}
                  name="location"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
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
                <Label htmlFor="meetingUrl">Link</Label>
                <Input id="meetingUrl" placeholder="https://…" {...register("meetingUrl")} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMeeting.isPending}>
              {createMeeting.isPending ? "Agendando…" : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
