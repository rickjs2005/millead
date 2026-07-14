import { prisma, Prisma } from "@millead/database";
import type { LandingPage, LandingPageSummary } from "../../domain/entities/landing-page.js";
import type {
  CreateLandingPageInput,
  LandingPageFilters,
  LandingPageRepository,
} from "../../domain/repositories/landing-page-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";

export class PrismaLandingPageRepository implements LandingPageRepository {
  async create(input: CreateLandingPageInput): Promise<LandingPage> {
    return prisma.landingPage.create({
      data: {
        organizationId: input.organizationId,
        companyId: input.companyId,
        leadId: input.leadId ?? null,
        createdById: input.createdById ?? null,
        slug: input.slug,
        title: input.title,
        kind: input.kind,
        brief: input.brief ?? null,
      },
    });
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<LandingPage | null> {
    return prisma.landingPage.findFirst({ where: { id, organizationId } });
  }

  async list(
    organizationId: string,
    filters: LandingPageFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<LandingPageSummary>> {
    const where: Prisma.LandingPageWhereInput = {
      organizationId,
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.landingPage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.landingPage.count({ where }),
    ]);
    return paginate(
      rows.map(({ html, ...rest }) => ({ ...rest, hasHtml: html !== null })),
      total,
      pagination,
    );
  }

  async markGenerating(id: string): Promise<void> {
    await prisma.landingPage.update({
      where: { id },
      data: { status: "GENERATING", errorMessage: null },
    });
  }

  async saveHtml(id: string, html: string): Promise<void> {
    await prisma.landingPage.update({
      where: { id },
      data: { status: "READY", html, errorMessage: null },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await prisma.landingPage.update({
      where: { id },
      data: { status: "FAILED", errorMessage },
    });
  }

  async requeue(
    id: string,
    organizationId: string,
    brief?: string | null,
  ): Promise<LandingPage | null> {
    const { count } = await prisma.landingPage.updateMany({
      where: { id, organizationId },
      data: {
        status: "QUEUED",
        errorMessage: null,
        ...(brief !== undefined ? { brief } : {}),
      },
    });
    if (count === 0) return null;
    return prisma.landingPage.findUniqueOrThrow({ where: { id } });
  }

  async setPublished(
    id: string,
    organizationId: string,
    published: boolean,
  ): Promise<LandingPage | null> {
    const { count } = await prisma.landingPage.updateMany({
      where: { id, organizationId },
      data: { isPublished: published, publishedAt: published ? new Date() : null },
    });
    if (count === 0) return null;
    return prisma.landingPage.findUniqueOrThrow({ where: { id } });
  }

  async delete(id: string, organizationId: string): Promise<boolean> {
    const { count } = await prisma.landingPage.deleteMany({ where: { id, organizationId } });
    return count > 0;
  }

  async findPublishedBySlug(slug: string): Promise<LandingPage | null> {
    return prisma.landingPage.findFirst({
      where: { slug, isPublished: true, status: "READY" },
    });
  }

  async incrementViews(id: string): Promise<void> {
    await prisma.landingPage.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }
}
