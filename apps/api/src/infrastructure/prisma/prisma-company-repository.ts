import { prisma, Prisma, type SocialPlatform } from "@millead/database";
import type { Company, CompanyDetail } from "../../domain/entities/company.js";
import type {
  CompanyFilters,
  CompanyRepository,
  CreateCompanyInput,
  UpdateCompanyInput,
} from "../../domain/repositories/company-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

export class PrismaCompanyRepository implements CompanyRepository {
  async create(input: CreateCompanyInput): Promise<Company> {
    return prisma.company.create({ data: input });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<CompanyDetail | null> {
    const company = await prisma.company.findFirst({
      where: { id, organizationId },
      include: { websites: true, socials: true },
    });
    return company;
  }

  async list(
    organizationId: string,
    filters: CompanyFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Company>> {
    const where: Prisma.CompanyWhereInput = {
      organizationId,
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" } },
              { document: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.company.findMany({ where, orderBy: { createdAt: "desc" }, ...toSkipTake(pagination) }),
      prisma.company.count({ where }),
    ]);
    return paginate(rows, total, pagination);
  }

  async update(
    id: string,
    organizationId: string,
    patch: UpdateCompanyInput,
  ): Promise<Company | null> {
    const { count } = await prisma.company.updateMany({
      where: { id, organizationId },
      data: patch,
    });
    if (count === 0) return null;
    return prisma.company.findUniqueOrThrow({ where: { id } });
  }

  async addWebsite(
    companyId: string,
    organizationId: string,
    input: { url: string; isPrimary?: boolean },
  ) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId } });
    if (!company) return null;
    return prisma.companyWebsite.create({
      data: { companyId, organizationId, url: input.url, isPrimary: input.isPrimary ?? false },
    });
  }

  async removeWebsite(id: string, companyId: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.companyWebsite.deleteMany({
      where: { id, companyId, organizationId },
    });
    return count > 0;
  }

  async addSocial(
    companyId: string,
    organizationId: string,
    input: { platform: SocialPlatform; handleOrUrl: string },
  ) {
    const company = await prisma.company.findFirst({ where: { id: companyId, organizationId } });
    if (!company) return null;
    return prisma.companySocial.create({
      data: { companyId, organizationId, platform: input.platform, handleOrUrl: input.handleOrUrl },
    });
  }

  async removeSocial(id: string, companyId: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.companySocial.deleteMany({
      where: { id, companyId, organizationId },
    });
    return count > 0;
  }
}
