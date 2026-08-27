import { Prisma, prisma } from "@millead/database";
import type {
  CreateRuleInput,
  PersonalRule,
  PersonalRuleRepository,
  UpdateRuleInput,
} from "../../domain/repositories/personal-rule-repository.js";
import { formatMoney, parseMoney } from "../../application/services/vault-money.js";

const ruleSelect = {
  id: true,
  vaultId: true,
  name: true,
  priority: true,
  isActive: true,
  matchType: true,
  matchValue: true,
  matchMerchantId: true,
  matchAccountId: true,
  matchCardId: true,
  matchAmountMin: true,
  matchAmountMax: true,
  setMerchantId: true,
  setCategoryId: true,
  setSubscriptionId: true,
  businessPercent: true,
} as const;

type RuleRow = Prisma.PersonalClassificationRuleGetPayload<{ select: typeof ruleSelect }>;

/** Converte a faixa de valor pra centavos na fronteira — ver o contrato. */
function toRule(row: RuleRow): PersonalRule {
  const { matchAmountMin, matchAmountMax, businessPercent, ...rest } = row;
  return {
    ...rest,
    matchAmountMinCents: matchAmountMin ? parseMoney(matchAmountMin.toString()) : null,
    matchAmountMaxCents: matchAmountMax ? parseMoney(matchAmountMax.toString()) : null,
    businessPercent: businessPercent?.toString() ?? null,
  };
}

function toRow(input: Partial<CreateRuleInput>) {
  const { matchAmountMinCents, matchAmountMaxCents, ...rest } = input;
  return {
    ...rest,
    ...(matchAmountMinCents !== undefined
      ? { matchAmountMin: matchAmountMinCents === null ? null : formatMoney(matchAmountMinCents) }
      : {}),
    ...(matchAmountMaxCents !== undefined
      ? { matchAmountMax: matchAmountMaxCents === null ? null : formatMoney(matchAmountMaxCents) }
      : {}),
  };
}

export class PrismaPersonalRuleRepository implements PersonalRuleRepository {
  async list(vaultId: string, includeInactive: boolean): Promise<PersonalRule[]> {
    const rows = await prisma.personalClassificationRule.findMany({
      where: { vaultId, ...(includeInactive ? {} : { isActive: true }) },
      select: ruleSelect,
      orderBy: [{ priority: "asc" }, { id: "asc" }],
    });
    return rows.map(toRule);
  }

  listActive(vaultId: string): Promise<PersonalRule[]> {
    return this.list(vaultId, false);
  }

  async findById(vaultId: string, id: string): Promise<PersonalRule | null> {
    const row = await prisma.personalClassificationRule.findFirst({
      where: { id, vaultId },
      select: ruleSelect,
    });
    return row ? toRule(row) : null;
  }

  async create(vaultId: string, input: CreateRuleInput): Promise<PersonalRule> {
    const row = await prisma.personalClassificationRule.create({
      data: { vaultId, ...toRow(input) },
      select: ruleSelect,
    });
    return toRule(row);
  }

  async update(vaultId: string, id: string, patch: UpdateRuleInput): Promise<PersonalRule | null> {
    const { count } = await prisma.personalClassificationRule.updateMany({
      where: { id, vaultId },
      data: toRow(patch),
    });
    if (count === 0) return null;
    return this.findById(vaultId, id);
  }

  async delete(vaultId: string, id: string): Promise<boolean> {
    const { count } = await prisma.personalClassificationRule.deleteMany({
      where: { id, vaultId },
    });
    return count > 0;
  }
}
