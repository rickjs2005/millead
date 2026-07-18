import { prisma, Prisma } from "@millead/database";
import type { Activity, NewActivity } from "../../domain/entities/activity.js";
import type { ActivityRepository } from "../../domain/repositories/activity-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

function toDomain(row: {
  id: string;
  organizationId: string;
  leadId: string | null;
  userId: string | null;
  type: Activity["type"];
  payload: Prisma.JsonValue;
  createdAt: Date;
}): Activity {
  return {
    id: row.id,
    organizationId: row.organizationId,
    leadId: row.leadId,
    userId: row.userId,
    type: row.type,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}

export class PrismaActivityRepository implements ActivityRepository {
  async record(entry: NewActivity): Promise<void> {
    await prisma.activity.create({
      data: {
        organizationId: entry.organizationId,
        leadId: entry.leadId,
        userId: entry.userId,
        type: entry.type,
        payload: entry.payload ? (entry.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }

  async listForLead(
    leadId: string,
    organizationId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Activity>> {
    const where = { leadId, organizationId };
    const [rows, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.activity.count({ where }),
    ]);
    return paginate(rows.map(toDomain), total, pagination);
  }

  async listRecentForOrg(organizationId: string, limit: number): Promise<Activity[]> {
    const rows = await prisma.activity.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toDomain);
  }
}
