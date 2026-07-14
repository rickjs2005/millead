"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2, UserRound } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddMeetingAttendee,
  useMeeting,
  useRemoveMeetingAttendee,
} from "@/features/meetings/hooks";

const schema = z.object({
  name: z.string().min(1, "Informe o nome."),
  email: z.string().email("E-mail inválido.").optional().or(z.literal("")),
  isInternal: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export function MeetingAttendeesDialog({
  meetingId,
  open,
  onOpenChange,
}: {
  meetingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Só busca o detalhe (com attendees) quando o dialog abre.
  const { data: meeting, isLoading } = useMeeting(open ? meetingId : undefined);
  const addAttendee = useAddMeetingAttendee(meetingId);
  const removeAttendee = useRemoveMeetingAttendee(meetingId);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", isInternal: false },
  });

  async function onSubmit(values: FormValues) {
    await addAttendee.mutateAsync({
      name: values.name,
      email: values.email || undefined,
      isInternal: values.isInternal,
    });
    reset();
  }

  const attendees = meeting?.attendees ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Participantes</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : attendees.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <UserRound className="h-4 w-4" /> Nenhum participante ainda.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {attendees.map((attendee) => (
                <div
                  key={attendee.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {attendee.name}
                      {attendee.isInternal && <Badge variant="secondary">Equipe</Badge>}
                    </span>
                    {attendee.email && (
                      <span className="truncate text-xs text-muted-foreground">
                        {attendee.email}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAttendee.mutate(attendee.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attendee-name">Nome</Label>
                <Input id="attendee-name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="attendee-email">E-mail</Label>
                <Input id="attendee-email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Controller
                  control={control}
                  name="isInternal"
                  render={({ field }) => (
                    <Checkbox
                      id="attendee-internal"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <Label htmlFor="attendee-internal" className="font-normal">
                  Membro da equipe
                </Label>
              </div>
              <Button type="submit" size="sm" disabled={addAttendee.isPending}>
                {addAttendee.isPending ? "Adicionando…" : "Adicionar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
