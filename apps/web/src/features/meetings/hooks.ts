import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  meetingsService,
  type CreateMeetingPayload,
  type ListMeetingsParams,
  type UpdateMeetingPayload,
} from "@/services/meetings";

export function useMeetings(params: ListMeetingsParams) {
  return useQuery({
    queryKey: queryKeys.meetings.list(params),
    queryFn: () => meetingsService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.meetings.detail(id ?? ""),
    queryFn: () => meetingsService.get(id!),
    enabled: !!id,
  });
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateMeetingPayload) => meetingsService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meetings", "list"] });
      toast.success("Reunião agendada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao agendar reunião."),
  });
}

export function useUpdateMeeting(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateMeetingPayload) => meetingsService.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(id) });
      queryClient.invalidateQueries({ queryKey: ["meetings", "list"] });
      toast.success("Reunião atualizada.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao atualizar reunião."),
  });
}

export function useAddMeetingAttendee(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; email?: string; isInternal?: boolean }) =>
      meetingsService.addAttendee(meetingId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(meetingId) });
      toast.success("Participante adicionado.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao adicionar participante."),
  });
}

export function useRemoveMeetingAttendee(meetingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attendeeId: string) => meetingsService.removeAttendee(meetingId, attendeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings.detail(meetingId) });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Erro ao remover participante."),
  });
}
