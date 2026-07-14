import type { MeetingLocation, MeetingStatus } from "@millead/database";
import type { Meeting, MeetingAttendee, MeetingDetail } from "../entities/meeting.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateMeetingInput {
  organizationId: string;
  leadId?: string | null;
  createdById?: string | null;
  title: string;
  scheduledAt: Date;
  durationMinutes?: number;
  location?: MeetingLocation;
  meetingUrl?: string | null;
}

export interface UpdateMeetingInput {
  title?: string;
  scheduledAt?: Date;
  durationMinutes?: number;
  location?: MeetingLocation;
  meetingUrl?: string | null;
  status?: MeetingStatus;
}

export interface MeetingFilters {
  leadId?: string;
  status?: MeetingStatus;
  from?: Date;
  to?: Date;
}

export interface MeetingRepository {
  create(input: CreateMeetingInput): Promise<Meeting>;
  findByIdForOrg(id: string, organizationId: string): Promise<MeetingDetail | null>;
  list(
    organizationId: string,
    filters: MeetingFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Meeting>>;
  update(id: string, organizationId: string, patch: UpdateMeetingInput): Promise<Meeting | null>;

  addAttendee(
    meetingId: string,
    organizationId: string,
    input: { name: string; email?: string; userId?: string; isInternal?: boolean },
  ): Promise<MeetingAttendee | null>;
  removeAttendee(id: string, meetingId: string, organizationId: string): Promise<boolean>;
}
