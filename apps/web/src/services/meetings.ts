import { api } from "./api-client";
import type {
  Meeting,
  MeetingAttendee,
  MeetingDetail,
  MeetingLocation,
  MeetingStatus,
  PaginatedResult,
} from "@/types/api";

export interface CreateMeetingPayload {
  title: string;
  leadId?: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: MeetingLocation;
  meetingUrl?: string;
}

export interface UpdateMeetingPayload {
  title?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  location?: MeetingLocation;
  meetingUrl?: string | null;
  status?: MeetingStatus;
}

export interface ListMeetingsParams {
  page?: number;
  pageSize?: number;
  leadId?: string;
  status?: MeetingStatus;
  from?: string;
  to?: string;
}

export const meetingsService = {
  list: (params: ListMeetingsParams = {}) =>
    api.get<PaginatedResult<Meeting>>("/api/v1/meetings", params),
  get: (id: string) => api.get<MeetingDetail>(`/api/v1/meetings/${id}`),
  create: (payload: CreateMeetingPayload) => api.post<Meeting>("/api/v1/meetings", payload),
  update: (id: string, payload: UpdateMeetingPayload) =>
    api.patch<Meeting>(`/api/v1/meetings/${id}`, payload),
  addAttendee: (
    meetingId: string,
    input: { name: string; email?: string; userId?: string; isInternal?: boolean },
  ) => api.post<MeetingAttendee>(`/api/v1/meetings/${meetingId}/attendees`, input),
  removeAttendee: (meetingId: string, attendeeId: string) =>
    api.delete<void>(`/api/v1/meetings/${meetingId}/attendees/${attendeeId}`),
};
