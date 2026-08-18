import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { computeInvestmentLines, renderProposalPdf } from "./render.js";

const DATA = {
  proposalNumber: "2026-ABC123",
  orgName: "MilWeb",
  clientName: "Clínica ABC",
  projectTitle: "Site Institucional Clínica ABC",
  productName: "Site Institucional",
  scopeItems: ["Design exclusivo", "Site responsivo", "SEO básico", "Integração com WhatsApp"],
  deadlineDays: 30,
  paymentTerms: "50% para iniciar, 50% na entrega",
  validDays: 15,
  finalPrice: 9500,
  infraMonthlyBrl: 103.33,
  infraMonths: 12,
  domainYears: null,
  domainCostBrl: 0,
  createdAt: new Date("2026-07-31"),
};

describe("renderProposalPdf", () => {
  it("prévia se identifica no próprio documento -- não pode passar por proposta final", async () => {
    const previa = await PDFDocument.load(await renderProposalPdf({ ...DATA, preview: true }));
    const final = await PDFDocument.load(await renderProposalPdf(DATA));
    expect(previa.getTitle()).toBe("Prévia de proposta");
    expect(final.getTitle()).toBe("Proposta 2026-ABC123");
  });

  it("gera PDF válido com ao menos 1 página", async () => {
    const bytes = await renderProposalPdf(DATA);
    expect(bytes.length).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("sem infra não quebra (linha de infraestrutura omitida)", async () => {
    const bytes = await renderProposalPdf({ ...DATA, infraMonthlyBrl: 0 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("escopo longo pagina sem estourar", async () => {
    const many = Array.from(
      { length: 30 },
      (_, i) => `Item de escopo número ${i + 1} com texto razoavelmente longo pra forçar quebra`,
    );
    const bytes = await renderProposalPdf({ ...DATA, scopeItems: many });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("com domínio contratado não quebra (linha de domínio incluída)", async () => {
    const bytes = await renderProposalPdf({ ...DATA, domainYears: 2, domainCostBrl: 80 });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("com domínio e sem infra não quebra (só a linha de domínio no breakdown)", async () => {
    const bytes = await renderProposalPdf({
      ...DATA,
      infraMonthlyBrl: 0,
      domainYears: 1,
      domainCostBrl: 40,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("computeInvestmentLines", () => {
  it("sem infra e sem domínio -- sem breakdown, dev = finalPrice", () => {
    const r = computeInvestmentLines({
      finalPrice: 9500,
      infraMonthlyBrl: 0,
      infraMonths: 12,
      domainCostBrl: 0,
    });
    expect(r.infraTotal).toBe(0);
    expect(r.domainTotal).toBe(0);
    expect(r.devPrice).toBe(9500);
    expect(r.showBreakdown).toBe(false);
  });

  it("com infra -- devPrice desconta infraTotal, breakdown ligado", () => {
    const r = computeInvestmentLines({
      finalPrice: 9500,
      infraMonthlyBrl: 103.33,
      infraMonths: 12,
      domainCostBrl: 0,
    });
    expect(r.infraTotal).toBeCloseTo(103.33 * 12, 2);
    expect(r.domainTotal).toBe(0);
    expect(r.devPrice).toBeCloseTo(9500 - 103.33 * 12, 2);
    expect(r.showBreakdown).toBe(true);
  });

  it("com domínio (2 anos × 40) -- devPrice desconta domainTotal, breakdown ligado mesmo sem infra", () => {
    const r = computeInvestmentLines({
      finalPrice: 9500,
      infraMonthlyBrl: 0,
      infraMonths: 12,
      domainCostBrl: 80,
    });
    expect(r.infraTotal).toBe(0);
    expect(r.domainTotal).toBe(80);
    expect(r.devPrice).toBe(9500 - 80);
    expect(r.showBreakdown).toBe(true);
  });

  it("com infra E domínio -- devPrice desconta os dois", () => {
    const r = computeInvestmentLines({
      finalPrice: 9500,
      infraMonthlyBrl: 100,
      infraMonths: 12,
      domainCostBrl: 80,
    });
    expect(r.infraTotal).toBe(1200);
    expect(r.domainTotal).toBe(80);
    expect(r.devPrice).toBe(9500 - 1200 - 80);
    expect(r.showBreakdown).toBe(true);
  });

  it("guard: infra + domínio >= finalPrice cai pra linha única (showBreakdown false)", () => {
    const r = computeInvestmentLines({
      finalPrice: 1000,
      infraMonthlyBrl: 100,
      infraMonths: 12, // 1200 já estoura o finalPrice sozinho
      domainCostBrl: 0,
    });
    expect(r.devPrice).toBeLessThanOrEqual(0);
    expect(r.showBreakdown).toBe(false);
  });
});
