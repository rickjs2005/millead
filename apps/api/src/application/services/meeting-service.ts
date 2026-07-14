import { NotFoundError } from "../../domain/errors/app-error.js";
import type {
  MeetingFilters,
  MeetingRepository,
  UpdateMeetingInput,
} from "../../domain/repositories/meeting-repository.js";
import type { PaginationParams } from "../../shared/pagination.js";
import type { CreateMeetingInput } from "../dto/meeting.dto.js";

export class MeetingService {
  constructor(private readonly repository: MeetingRepository) {}

  create(organizationId: string, createdById: string, input: CreateMeetingInput) {
    return this.repository.create({ organizationId, createdById, ...input });
  }

  async get(organizationId: string, id: string) {
    const meeting = await this.repository.findByIdForOrg(id, organizationId);
    if (!meeting) throw new NotFoundError("Reunião não encontrada.");
    return meeting;
  }

  list(organizationId: string, filters: MeetingFilters, pagination: PaginationParams) {
    return this.repository.list(organizationId, filters, pagination);
  }

  async update(organizationId: string, id: string, patch: UpdateMeetingInput) {
    const meeting = await this.repository.update(id, organizationId, patch);
    if (!meeting) throw new NotFoundError("Reunião não encontrada.");
    return meeting;
  }

  async addAttendee(
    organizationId: string,
    meetingId: string,
    input: { name: string; email?: string; userId?: string; isInternal?: boolean },
  ) {
    const attendee = await this.repository.addAttendee(meetingId, organizationId, input);
    if (!attendee) throw new NotFoundError("Reunião não encontrada.");
    return attendee;
  }

  async removeAttendee(organizationId: string, meetingId: string, attendeeId: string) {
    const removed = await this.repository.removeAttendee(attendeeId, meetingId, organizationId);
    if (!removed) throw new NotFoundError("Participante não encontrado.");
  }
}
