import type { MeetingLocation, MeetingStatus } from "@/types/api";

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  SCHEDULED: "Agendada",
  COMPLETED: "Concluída",
  CANCELED: "Cancelada",
  NO_SHOW: "Não compareceu",
};

export const MEETING_STATUS_VARIANT: Record<
  MeetingStatus,
  "default" | "success" | "secondary" | "destructive"
> = {
  SCHEDULED: "default",
  COMPLETED: "success",
  CANCELED: "secondary",
  NO_SHOW: "destructive",
};

export const MEETING_LOCATION_LABELS: Record<MeetingLocation, string> = {
  ONLINE: "Online",
  IN_PERSON: "Presencial",
  PHONE: "Telefone",
};
