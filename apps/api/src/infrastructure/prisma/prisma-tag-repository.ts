import { prisma } from "@millead/database";
import type { Tag } from "../../domain/entities/tag.js";
import type { TagRepository } from "../../domain/repositories/tag-repository.js";

export class PrismaTagRepository implements TagRepository {
  async listForOrg(organizationId: string): Promise<Tag[]> {
    return prisma.tag.findMany({ where: { organizationId }, orderBy: { name: "asc" } });
  }

  async create(organizationId: string, name: string, color?: string): Promise<Tag> {
    return prisma.tag.create({ data: { organizationId, name, color } });
  }
}
