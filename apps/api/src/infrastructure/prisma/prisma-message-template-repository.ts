import { prisma } from "@millead/database";
import type { MessageTemplate } from "../../domain/entities/message.js";
import type {
  CreateMessageTemplateInput,
  MessageTemplateRepository,
  UpdateMessageTemplateInput,
} from "../../domain/repositories/message-template-repository.js";

export class PrismaMessageTemplateRepository implements MessageTemplateRepository {
  async create(input: CreateMessageTemplateInput): Promise<MessageTemplate> {
    return prisma.messageTemplate.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        channel: input.channel,
        subject: input.subject ?? null,
        body: input.body,
      },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<MessageTemplate | null> {
    return prisma.messageTemplate.findFirst({ where: { id, organizationId } });
  }

  async listForOrg(organizationId: string): Promise<MessageTemplate[]> {
    return prisma.messageTemplate.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
  }

  async update(
    id: string,
    organizationId: string,
    patch: UpdateMessageTemplateInput,
  ): Promise<MessageTemplate | null> {
    const { count } = await prisma.messageTemplate.updateMany({
      where: { id, organizationId },
      data: patch,
    });
    if (count === 0) return null;
    return prisma.messageTemplate.findUniqueOrThrow({ where: { id } });
  }
}
