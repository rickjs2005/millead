import { prisma, Prisma } from "@millead/database";
import type { Meeting, MeetingDetail } from "../../domain/entities/meeting.js";
import type {
  CreateMeetingInput,
  MeetingFilters,
  MeetingRepository,
  UpdateMeetingInput,
} from "../../domain/repositories/meeting-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

export class PrismaMeetingRepository implements MeetingRepository {
  async create(input: CreateMeetingInput): Promise<Meeting> {
    return prisma.meeting.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId ?? null,
        createdById: input.createdById ?? null,
        title: input.title,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        location: input.location,
        meetingUrl: input.meetingUrl ?? null,
      },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<MeetingDetail | null> {
    return prisma.meeting.findFirst({
      where: { id, organizationId },
      include: { attendees: true },
    });
  }

  async list(
    organizationId: string,
    filters: MeetingFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Meeting>> {
    const where: Prisma.MeetingWhereInput = {
      organizationId,
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? { scheduledAt: { gte: filters.from, lte: filters.to } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        ...toSkipTake(pagination),
      }),
      prisma.meeting.count({ where }),
    ]);
    return paginate(rows, total, pagination);
  }

  async update(
    id: string,
    organizationId: string,
    patch: UpdateMeetingInput,
  ): Promise<Meeting | null> {
    const { count } = await prisma.meeting.updateMany({
      where: { id, organizationId },
      data: patch,
    });
    if (count === 0) return null;
    return prisma.meeting.findUniqueOrThrow({ where: { id } });
  }

  async addAttendee(
    meetingId: string,
    organizationId: string,
    input: { name: string; email?: string; userId?: string; isInternal?: boolean },
  ) {
    const meeting = await prisma.meeting.findFirst({ where: { id: meetingId, organizationId } });
    if (!meeting) return null;
    return prisma.meetingAttendee.create({
      data: {
        organizationId,
        meetingId,
        name: input.name,
        email: input.email,
        userId: input.userId,
        isInternal: input.isInternal ?? false,
      },
    });
  }

  async removeAttendee(id: string, meetingId: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.meetingAttendee.deleteMany({
      where: { id, meetingId, organizationId },
    });
    return count > 0;
  }
}
