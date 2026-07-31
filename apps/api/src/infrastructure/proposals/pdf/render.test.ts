import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderProposalPdf } from "./render.js";

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
  createdAt: new Date("2026-07-31"),
};

describe("renderProposalPdf", () => {
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
    const many = Array.from({ length: 30 }, (_, i) => `Item de escopo número ${i + 1} com texto razoavelmente longo pra forçar quebra`);
    const bytes = await renderProposalPdf({ ...DATA, scopeItems: many });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
