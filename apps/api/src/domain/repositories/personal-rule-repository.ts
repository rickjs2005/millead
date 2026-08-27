import type { RuleMatchType } from "../../application/services/classification-rule-match.js";

/**
 * Regras de classificação do Cofre.
 *
 * Os valores monetários das condições entram e saem em **centavos inteiros**,
 * e não como string decimal como no resto do módulo: quem consome é o
 * comparador de faixa (`ruleMatches`), que trabalha em centavos. Converter na
 * fronteira do repositório evita que cada chamador lembre de converter — e
 * um chamador que esquecesse compararia string com número.
 */

export interface PersonalRule {
  id: string;
  vaultId: string;
  name: string | null;
  priority: number;
  isActive: boolean;

  matchType: RuleMatchType | null;
  /** Já normalizado. */
  matchValue: string | null;
  matchMerchantId: string | null;
  matchAccountId: string | null;
  matchCardId: string | null;
  matchAmountMinCents: number | null;
  matchAmountMaxCents: number | null;

  setMerchantId: string | null;
  setCategoryId: string | null;
  setSubscriptionId: string | null;
  /** Percentual (0-100) como string decimal. */
  businessPercent: string | null;
}

export type CreateRuleInput = Omit<PersonalRule, "id" | "vaultId">;
export type UpdateRuleInput = Partial<CreateRuleInput>;

export interface PersonalRuleRepository {
  list(vaultId: string, includeInactive: boolean): Promise<PersonalRule[]>;
  /** Só as ativas, já ordenadas — é o que a cascata consome. */
  listActive(vaultId: string): Promise<PersonalRule[]>;
  findById(vaultId: string, id: string): Promise<PersonalRule | null>;
  create(vaultId: string, input: CreateRuleInput): Promise<PersonalRule>;
  update(vaultId: string, id: string, patch: UpdateRuleInput): Promise<PersonalRule | null>;
  delete(vaultId: string, id: string): Promise<boolean>;
}
