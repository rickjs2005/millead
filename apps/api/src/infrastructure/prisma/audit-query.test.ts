import { describe, expect, it } from "vitest";
import { buildAuditWhere, groupsByCompany } from "./audit-query.js";

const ORG = "org_1";

describe("groupsByCompany", () => {
  it("agrupa quando `latestPerCompany` é pedido e nenhuma empresa foi escolhida", () => {
    expect(groupsByCompany({ latestPerCompany: true })).toBe(true);
  });

  it("não agrupa quando uma empresa foi escolhida -- aí é histórico", () => {
    expect(groupsByCompany({ latestPerCompany: true, companyId: "co_1" })).toBe(false);
  });

  it("não agrupa por padrão", () => {
    expect(groupsByCompany({})).toBe(false);
    expect(groupsByCompany({ companyId: "co_1" })).toBe(false);
  });
});

describe("buildAuditWhere", () => {
  it("sempre escopa pela organização", () => {
    expect(buildAuditWhere(ORG, {}).organizationId).toBe(ORG);
  });

  it("filtra por empresa quando pedido", () => {
    expect(buildAuditWhere(ORG, { companyId: "co_1" }).companyId).toBe("co_1");
  });

  it("filtra por status quando pedido", () => {
    expect(buildAuditWhere(ORG, { status: "COMPLETED" }).status).toBe("COMPLETED");
  });

  it("não injeta filtro de empresa nem de status quando não são pedidos", () => {
    const where = buildAuditWhere(ORG, {});

    expect(where.companyId).toBeUndefined();
    expect(where.status).toBeUndefined();
  });

  it("ignora `latestPerCompany` -- agrupamento não é filtro de linha", () => {
    const where = buildAuditWhere(ORG, { latestPerCompany: true });

    expect(where).toEqual({ organizationId: ORG });
  });
});
