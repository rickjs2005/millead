import { prisma } from "@millead/database";
import type { Organization } from "../../domain/entities/organization.js";
import type {
  CreateOrganizationInput,
  OrganizationRepository,
} from "../../domain/repositories/organization-repository.js";

export class PrismaOrganizationRepository implements OrganizationRepository {
  async findBySlug(slug: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { slug } });
  }

  async findById(id: string): Promise<Organization | null> {
    return prisma.organization.findUnique({ where: { id } });
  }

  async create(input: CreateOrganizationInput): Promise<Organization> {
    return prisma.organization.create({ data: input });
  }
}
