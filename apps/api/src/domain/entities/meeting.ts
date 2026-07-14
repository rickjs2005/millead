import type { MeetingLocation, MeetingStatus } from "@millead/database";

export interface Meeting {
  id: string;
  organizationId: string;
  leadId: string | null;
  createdById: string | null;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  location: MeetingLocation;
  meetingUrl: string | null;
  status: MeetingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MeetingAttendee {
  id: string;
  meetingId: string;
  userId: string | null;
  name: string;
  email: string | null;
  isInternal: boolean;
}

export interface MeetingDetail extends Meeting {
  attendees: MeetingAttendee[];
}
