import { prisma, Prisma } from "@millead/database";
import type { Message } from "../../domain/entities/message.js";
import type {
  CreateMessageInput,
  MessageFilters,
  MessageRepository,
  UpdateMessageInput,
} from "../../domain/repositories/message-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

export class PrismaMessageRepository implements MessageRepository {
  async create(input: CreateMessageInput): Promise<Message> {
    return prisma.message.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        templateId: input.templateId ?? null,
        channel: input.channel,
        body: input.body,
      },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<Message | null> {
    return prisma.message.findFirst({ where: { id, organizationId } });
  }

  async list(
    organizationId: string,
    filters: MessageFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Message>> {
    const where: Prisma.MessageWhereInput = {
      organizationId,
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.message.count({ where }),
    ]);
    return paginate(rows, total, pagination);
  }

  async update(
    id: string,
    organizationId: string,
    patch: UpdateMessageInput,
  ): Promise<Message | null> {
    const { count } = await prisma.message.updateMany({
      where: { id, organizationId },
      data: patch,
    });
    if (count === 0) return null;
    return prisma.message.findUniqueOrThrow({ where: { id } });
  }
}
