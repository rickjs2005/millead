import { describe, expect, it } from "vitest";
import { montarPdfDaProposta } from "./estimate-pdf-payload.js";

const BASE = {
  estimate: {
    title: "Website Institucional",
    scopeItems: ["5 páginas", "Formulário de contato"],
    deadlineDays: 30,
    paymentTerms: "50% entrada, 50% na entrega",
    validDays: 15,
    infraMonths: 12,
    domainYears: 1,
    finalPrice: null as number | null,
  },
  computed: { infraMonthlyBrl: 40, domainCost: 60, priceRecommended: 5460 },
  orgName: "MilWeb",
  clientName: "KPM Transportes",
  productName: "Site Institucional",
  proposalNumber: "2026-A1B2C3",
  createdAt: new Date("2026-08-18T12:00:00Z"),
};

describe("montarPdfDaProposta", () => {
  it("sem preço decidido, usa o recomendado", () => {
    expect(montarPdfDaProposta(BASE).finalPrice).toBe(5460);
  });

  it("preço final salvo pelo dono ganha do recomendado", () => {
    const dados = montarPdfDaProposta({
      ...BASE,
      estimate: { ...BASE.estimate, finalPrice: 6000 },
    });
    expect(dados.finalPrice).toBe(6000);
  });

  it("preço explícito da conversão ganha de tudo", () => {
    const dados = montarPdfDaProposta({
      ...BASE,
      estimate: { ...BASE.estimate, finalPrice: 6000 },
      priceOverride: 7200,
    });
    expect(dados.finalPrice).toBe(7200);
  });

  it("preço zero é decisão válida, não ausência de preço", () => {
    const dados = montarPdfDaProposta({
      ...BASE,
      estimate: { ...BASE.estimate, finalPrice: 0 },
    });
    expect(dados.finalPrice).toBe(0);
  });

  // O motivo de existir esta função: se prévia e proposta final divergirem,
  // a prévia mente sobre o documento que o cliente vai assinar.
  it("prévia e proposta final só diferem no rótulo e no número", () => {
    const final = montarPdfDaProposta(BASE);
    const previa = montarPdfDaProposta({ ...BASE, proposalNumber: "PRÉVIA", preview: true });

    expect(previa).toEqual({ ...final, proposalNumber: "PRÉVIA", preview: true });
  });

  it("repassa escopo, prazo e condições do orçamento sem inventar nada", () => {
    const dados = montarPdfDaProposta(BASE);
    expect(dados).toMatchObject({
      orgName: "MilWeb",
      clientName: "KPM Transportes",
      projectTitle: "Website Institucional",
      productName: "Site Institucional",
      scopeItems: ["5 páginas", "Formulário de contato"],
      deadlineDays: 30,
      paymentTerms: "50% entrada, 50% na entrega",
      validDays: 15,
      infraMonthlyBrl: 40,
      infraMonths: 12,
      domainYears: 1,
      domainCostBrl: 60,
      preview: false,
    });
  });
});
