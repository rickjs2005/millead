import { describe, expect, it } from "vitest";
import { buildBriefingWhere } from "./briefing-where.js";

const ORG = "org_1";

describe("buildBriefingWhere", () => {
  it("esconde arquivados quando nenhum status é pedido", () => {
    const where = buildBriefingWhere(ORG, {});

    expect(where.status).toEqual({ not: "ARCHIVED" });
  });

  it("mostra os arquivados quando o filtro pede ARCHIVED explicitamente", () => {
    const where = buildBriefingWhere(ORG, { status: "ARCHIVED" });

    expect(where.status).toBe("ARCHIVED");
  });

  it("respeita qualquer outro status pedido", () => {
    const where = buildBriefingWhere(ORG, { status: "COMPLETED" });

    expect(where.status).toBe("COMPLETED");
  });

  it("continua escondendo arquivados quando filtra por lead", () => {
    const where = buildBriefingWhere(ORG, { leadId: "lead_1" });

    expect(where.leadId).toBe("lead_1");
    expect(where.status).toEqual({ not: "ARCHIVED" });
  });

  it("sempre escopa pela organização", () => {
    expect(buildBriefingWhere(ORG, {}).organizationId).toBe(ORG);
  });

  it("busca por nome e e-mail do contato, sem diferenciar maiúsculas", () => {
    const where = buildBriefingWhere(ORG, { search: "kavita" });

    expect(where.OR).toEqual([
      { contactName: { contains: "kavita", mode: "insensitive" } },
      { contactEmail: { contains: "kavita", mode: "insensitive" } },
    ]);
  });

  it("não injeta OR quando não há busca", () => {
    expect(buildBriefingWhere(ORG, {}).OR).toBeUndefined();
  });
});
