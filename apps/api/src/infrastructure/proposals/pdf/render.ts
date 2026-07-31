import { PDFDocument } from "pdf-lib";
import {
  COLORS,
  CONTENT_W,
  MARGIN,
  PAGE_H,
  PAGE_W,
  TOP_START,
  drawFooters,
  drawHeader,
  drawParagraph,
  embedFonts,
  ensureSpace,
  sanitize,
  type Doc,
  type Fonts,
} from "../../pdf/layout.js";
import { fmtBRL } from "../../contracts/pdf/format.js";

/** Dados já resolvidos (sem custo interno/margem/rateio) para o PDF de proposta. */
export interface ProposalPdfData {
  proposalNumber: string; // ex.: "2026-A1B2C3"
  orgName: string; // capa
  clientName: string; // empresa do lead, ou título do lead
  projectTitle: string; // título do orçamento
  productName: string | null; // nome do ProjectProduct, se houver
  scopeItems: string[]; // bullets do escopo
  deadlineDays: number;
  paymentTerms: string;
  validDays: number;
  finalPrice: number; // preço escolhido na conversão
  infraMonthlyBrl: number; // computed do orçamento (0 = sem linha de infra)
  infraMonths: number;
  createdAt: Date;
}

// Data por extenso sem hora (a proposta é lida pelo cliente, não precisa do
// horário de criação do registro).
const fmtDataLonga = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(d);

// Card de resumo (mesma técnica do card de resumo financeiro de contracts/pdf/render.ts:
// retângulo com fundo brandWeak/borda brandBorder, rótulos pequenos em maiúsculas + valor
// em negrito, distribuídos em colunas).
function drawSummaryCard(doc: Doc, data: ProposalPdfData): void {
  const pad = 12;
  const cardH = 78;
  ensureSpace(doc, cardH + 8);

  const topY = doc.y;
  const boxBottom = topY - cardH;

  doc.page.drawRectangle({
    x: MARGIN,
    y: boxBottom,
    width: CONTENT_W,
    height: cardH,
    color: COLORS.brandWeak,
    borderColor: COLORS.brandBorder,
    borderWidth: 1,
  });

  const projeto = data.productName
    ? `${data.projectTitle} - ${data.productName}`
    : data.projectTitle;

  const cells: Array<{ label: string; value: string }> = [
    { label: "PROJETO", value: projeto },
    { label: "PRAZO", value: `${data.deadlineDays} dias` },
    { label: "INVESTIMENTO", value: fmtBRL(data.finalPrice) },
  ];
  const cellW = (CONTENT_W - pad * 2) / cells.length;
  const labelY = topY - pad - 6.5;
  const valueY = topY - pad - 6.5 - 18;
  const valueMaxWidth = cellW - 6;

  cells.forEach((cell, i) => {
    const cellX = MARGIN + pad + i * cellW;
    doc.page.drawText(sanitize(cell.label), {
      x: cellX,
      y: labelY,
      size: 6.5,
      font: doc.fonts.regular,
      color: COLORS.muted,
    });
    // Valor pode ser mais longo que a coluna (ex.: título do projeto) --
    // reduz o tamanho da fonte se necessário em vez de estourar a coluna.
    let size = 10.5;
    const value = sanitize(cell.value);
    while (size > 7.5 && doc.fonts.bold.widthOfTextAtSize(value, size) > valueMaxWidth) {
      size -= 0.5;
    }
    doc.page.drawText(value, {
      x: cellX,
      y: valueY,
      size,
      font: doc.fonts.bold,
      color: COLORS.ink,
    });
  });

  doc.y = boxBottom - 14;
}

function drawSectionTitle(doc: Doc, title: string): void {
  ensureSpace(doc, 26);
  doc.y -= 10;
  drawParagraph(doc, title.toUpperCase(), {
    size: 10.5,
    font: doc.fonts.bold,
    color: COLORS.brand,
    lineHeight: 16,
  });
}

function drawScope(doc: Doc, scopeItems: string[]): void {
  drawSectionTitle(doc, "O que está incluso");
  for (const item of scopeItems) {
    // drawParagraph já chama ensureSpace por linha -- pagina sozinho para
    // escopos longos, sem estourar o fim da página.
    drawParagraph(doc, `- ${sanitize(item)}`, {
      size: 9.5,
      font: doc.fonts.regular,
      color: COLORS.body,
      lineHeight: 14,
    });
  }
}

// Linha do total do investimento -- fundo brandWeak com barra à esquerda,
// valor em destaque à direita.
function drawInvestmentRow(
  doc: Doc,
  label: string,
  value: string,
  opts: { highlight?: boolean } = {},
): void {
  const rowH = opts.highlight ? 34 : 26;
  ensureSpace(doc, rowH + 4);
  const topY = doc.y;
  const boxBottom = topY - rowH;

  if (opts.highlight) {
    doc.page.drawRectangle({
      x: MARGIN,
      y: boxBottom,
      width: CONTENT_W,
      height: rowH,
      color: COLORS.brandWeak,
      borderColor: COLORS.brandBorder,
      borderWidth: 1,
    });
  }

  const pad = opts.highlight ? 12 : 2;
  const labelSize = opts.highlight ? 10.5 : 9.5;
  const valueSize = opts.highlight ? 15 : 10;
  const textY = boxBottom + rowH / 2 - labelSize / 2 + 1;

  const labelText = sanitize(label);
  doc.page.drawText(labelText, {
    x: MARGIN + pad,
    y: textY,
    size: labelSize,
    font: opts.highlight ? doc.fonts.bold : doc.fonts.regular,
    color: opts.highlight ? COLORS.ink : COLORS.body,
  });

  const valueText = sanitize(value);
  const valueW = doc.fonts.bold.widthOfTextAtSize(valueText, valueSize);
  doc.page.drawText(valueText, {
    x: MARGIN + CONTENT_W - pad - valueW,
    y: boxBottom + rowH / 2 - valueSize / 2 + 1,
    size: valueSize,
    font: doc.fonts.bold,
    color: opts.highlight ? COLORS.brand : COLORS.ink,
  });

  doc.y = boxBottom - (opts.highlight ? 6 : 2);
}

function drawInvestment(doc: Doc, data: ProposalPdfData): void {
  drawSectionTitle(doc, "Investimento");

  const infraTotal = data.infraMonthlyBrl > 0 ? data.infraMonthlyBrl * data.infraMonths : 0;
  const devPrice = data.finalPrice - infraTotal;

  // Orçamento estranho (infra >= preço final) não pode gerar linha negativa
  // no PDF do cliente -- cai para linha única com o total.
  if (data.infraMonthlyBrl > 0 && devPrice > 0) {
    drawInvestmentRow(doc, "Desenvolvimento e implantação", fmtBRL(devPrice));
    drawInvestmentRow(doc, `Infraestrutura (${data.infraMonths} meses)`, fmtBRL(infraTotal));
    doc.y -= 4;
  }

  drawInvestmentRow(doc, "Total", fmtBRL(data.finalPrice), { highlight: true });
}

function drawConditions(doc: Doc, data: ProposalPdfData): void {
  drawSectionTitle(doc, "Condições");
  drawParagraph(doc, `Forma de pagamento: ${sanitize(data.paymentTerms)}`, {
    size: 9.5,
    font: doc.fonts.regular,
    color: COLORS.body,
    lineHeight: 14,
  });
  drawParagraph(
    doc,
    `Proposta válida por ${data.validDays} dias a partir de ${fmtDataLonga(data.createdAt)}.`,
    {
      size: 9.5,
      font: doc.fonts.regular,
      color: COLORS.body,
      lineHeight: 14,
    },
  );
}

/** Renderiza a proposta comercial em PDF com pdf-lib. Texto pro cliente:
 * nunca inclui custo interno, margem, rateio ou custo/hora. */
export async function renderProposalPdf(data: ProposalPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Proposta ${data.proposalNumber}`);
  pdf.setAuthor(data.orgName);

  const fonts: Fonts = await embedFonts(pdf);
  const firstPage = pdf.addPage([PAGE_W, PAGE_H]);
  const doc: Doc = {
    pdf,
    fonts,
    page: firstPage,
    y: TOP_START,
    header: {
      brandTitle: data.orgName,
      brandSubtitle: "P R O P O S T A",
      chipLabel: "PROPOSTA Nº",
      chipValue: data.proposalNumber,
      chipSub: `Emitido em ${fmtDataLonga(data.createdAt)}`,
    },
  };
  doc.y = drawHeader(doc);

  // 1. Capa/cabeçalho: título + "Para: cliente".
  doc.page.drawText(sanitize("Proposta Comercial"), {
    x: MARGIN,
    y: doc.y - 15,
    size: 15,
    font: fonts.bold,
    color: COLORS.ink,
  });
  doc.y -= 15 + 6;
  doc.page.drawRectangle({ x: MARGIN, y: doc.y - 3, width: 42, height: 3, color: COLORS.brand });
  doc.y -= 3 + 12;
  drawParagraph(doc, `Para: ${sanitize(data.clientName)}`, {
    size: 10,
    font: fonts.regular,
    color: COLORS.muted,
    lineHeight: 14,
  });
  doc.y -= 4;

  // 2. Resumo.
  drawSummaryCard(doc, data);

  // 3. Escopo.
  drawScope(doc, data.scopeItems);

  // 4. Investimento.
  drawInvestment(doc, data);

  // 5. Condições.
  drawConditions(doc, data);

  // 6. Rodapés (segundo passe, com numeração final).
  drawFooters(pdf, fonts, {
    footerLeft: data.orgName,
    footerCenter: `Proposta comercial - ${data.proposalNumber}`,
  });

  return pdf.save();
}
