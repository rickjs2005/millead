import { prisma, Prisma } from "@millead/database";
import type { BriefingAnswer } from "../../domain/entities/briefing.js";
import type {
  BriefingAnswerRepository,
  UpsertAnswerInput,
} from "../../domain/repositories/briefing-answer-repository.js";

export class PrismaBriefingAnswerRepository implements BriefingAnswerRepository {
  async upsert(input: UpsertAnswerInput): Promise<BriefingAnswer> {
    const groupItemId = input.groupItemId ?? "";
    return prisma.briefingAnswer.upsert({
      where: {
        briefingId_fieldId_groupItemId: {
          briefingId: input.briefingId,
          fieldId: input.fieldId,
          groupItemId,
        },
      },
      update: {
        groupItemOrder: input.groupItemOrder ?? null,
        valueText: input.valueText ?? null,
        valueJson:
          input.valueJson === undefined
            ? Prisma.JsonNull
            : (input.valueJson as Prisma.InputJsonValue),
      },
      create: {
        organizationId: input.organizationId,
        briefingId: input.briefingId,
        fieldId: input.fieldId,
        groupItemId,
        groupItemOrder: input.groupItemOrder ?? null,
        valueText: input.valueText ?? null,
        valueJson:
          input.valueJson === undefined
            ? Prisma.JsonNull
            : (input.valueJson as Prisma.InputJsonValue),
      },
    });
  }

  async listForBriefing(briefingId: string, organizationId: string): Promise<BriefingAnswer[]> {
    return prisma.briefingAnswer.findMany({ where: { briefingId, organizationId } });
  }

  async removeGroupItem(
    briefingId: string,
    organizationId: string,
    groupItemId: string,
  ): Promise<void> {
    if (!groupItemId) return; // nunca apaga campos de topo (groupItemId === "")
    await prisma.briefingAnswer.deleteMany({ where: { briefingId, organizationId, groupItemId } });
  }
}
