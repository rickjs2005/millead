import { PDFDocument, type PDFFont } from "pdf-lib";
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
  wrapText,
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
  domainYears: number | null; // Fase 6 -- null = orçamento sem domínio
  domainCostBrl: number; // computed.domainCost (0 = sem linha de domínio)
  createdAt: Date;
  /** true = prévia baixada do orçamento: rótulo no topo pra ninguém tratar
   *  um rascunho como proposta fechada (nem mandar pro cliente sem querer). */
  preview?: boolean;
}

// Data por extenso sem hora (a proposta é lida pelo cliente, não precisa do
// horário de criação do registro).
const fmtDataLonga = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(d);

const SUMMARY_VALUE_SIZE = 10;
const SUMMARY_VALUE_LINE_H = 12;
const SUMMARY_VALUE_MAX_LINES = 2;

// Corta `text` (já garantido caber em maxWidth por wrapText linha a linha) e
// acrescenta "..." quando há conteúdo além do que coube nas linhas mantidas --
// nunca desenha além do início da próxima coluna.
function truncateWithEllipsis(font: PDFFont, text: string, size: number, maxWidth: number): string {
  const suffix = "...";
  let s = text;
  while (s.length > 0 && font.widthOfTextAtSize(s + suffix, size) > maxWidth) {
    s = s.slice(0, -1);
  }
  s = s.trimEnd();
  return s.length > 0 ? `${s}${suffix}` : suffix;
}

// Quebra o valor de uma célula do card em até `maxLines` linhas que cabem em
// `maxWidth` (usa wrapText do layout, que já sanitiza); se sobrar conteúdo
// além disso, a última linha mantida ganha reticências.
function wrapCellValue(
  font: PDFFont,
  text: string,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines = wrapText(text, font, size, maxWidth);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const lastLine = kept[maxLines - 1] ?? "";
  kept[maxLines - 1] = truncateWithEllipsis(font, lastLine, size, maxWidth);
  return kept;
}

// Card de resumo (mesma técnica do card de resumo financeiro de contracts/pdf/render.ts:
// retângulo com fundo brandWeak/borda brandBorder, rótulos pequenos em maiúsculas + valor
// em negrito, distribuídos em colunas). O valor de cada coluna é limitado à LARGURA da
// própria coluna (widthOfTextAtSize via wrapText), quebrando em até 2 linhas e cortando
// com "..." se ainda exceder -- nunca invade a coluna vizinha.
function drawSummaryCard(doc: Doc, data: ProposalPdfData): void {
  const pad = 12;

  const projeto = data.productName
    ? `${data.projectTitle} - ${data.productName}`
    : data.projectTitle;

  const cells: Array<{ label: string; value: string }> = [
    { label: "PROJETO", value: projeto },
    { label: "PRAZO", value: `${data.deadlineDays} dias` },
    { label: "INVESTIMENTO", value: fmtBRL(data.finalPrice) },
  ];
  const cellW = (CONTENT_W - pad * 2) / cells.length;
  const valueMaxWidth = cellW - 6;

  const cellLines = cells.map((cell) =>
    wrapCellValue(
      doc.fonts.bold,
      sanitize(cell.value),
      SUMMARY_VALUE_SIZE,
      valueMaxWidth,
      SUMMARY_VALUE_MAX_LINES,
    ),
  );
  const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length));
  // Altura base (1 linha de valor) + linhas extras quando o título quebra.
  const cardH = 78 + (maxLines - 1) * SUMMARY_VALUE_LINE_H;

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

  const labelY = topY - pad - 6.5;
  const firstValueY = labelY - 18;

  cells.forEach((cell, i) => {
    const cellX = MARGIN + pad + i * cellW;
    doc.page.drawText(sanitize(cell.label), {
      x: cellX,
      y: labelY,
      size: 6.5,
      font: doc.fonts.regular,
      color: COLORS.muted,
    });
    (cellLines[i] ?? []).forEach((line, lineIdx) => {
      doc.page.drawText(line, {
        x: cellX,
        y: firstValueY - lineIdx * SUMMARY_VALUE_LINE_H,
        size: SUMMARY_VALUE_SIZE,
        font: doc.fonts.bold,
        color: COLORS.ink,
      });
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

/**
 * Calcula as linhas do bloco Investimento (dev - infra - domínio). Extraído
 * de `drawInvestment` pra ser testável em unidade -- o texto desenhado no
 * PDF (pdf-lib) não dá pra inspecionar direto num teste, mas essa conta sim.
 */
export function computeInvestmentLines(
  data: Pick<ProposalPdfData, "finalPrice" | "infraMonthlyBrl" | "infraMonths" | "domainCostBrl">,
): { infraTotal: number; domainTotal: number; devPrice: number; showBreakdown: boolean } {
  const infraTotal = data.infraMonthlyBrl > 0 ? data.infraMonthlyBrl * data.infraMonths : 0;
  const domainTotal = data.domainCostBrl > 0 ? data.domainCostBrl : 0;
  const devPrice = data.finalPrice - infraTotal - domainTotal;
  // Orçamento estranho (infra + domínio >= preço final) não pode gerar linha
  // negativa no PDF do cliente -- cai para linha única com o total.
  const showBreakdown = (infraTotal > 0 || domainTotal > 0) && devPrice > 0;
  return { infraTotal, domainTotal, devPrice, showBreakdown };
}

function drawInvestment(doc: Doc, data: ProposalPdfData): void {
  drawSectionTitle(doc, "Investimento");

  const { infraTotal, domainTotal, devPrice, showBreakdown } = computeInvestmentLines(data);

  if (showBreakdown) {
    drawInvestmentRow(doc, "Desenvolvimento e implantação", fmtBRL(devPrice));
    if (infraTotal > 0) {
      drawInvestmentRow(doc, `Infraestrutura (${data.infraMonths} meses)`, fmtBRL(infraTotal));
    }
    if (domainTotal > 0) {
      const years = data.domainYears ?? 0;
      drawInvestmentRow(
        doc,
        `Registro de domínio (${years} ${years === 1 ? "ano" : "anos"})`,
        fmtBRL(domainTotal),
      );
    }
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
  pdf.setTitle(data.preview ? "Prévia de proposta" : `Proposta ${data.proposalNumber}`);
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
      brandSubtitle: data.preview ? "P R É V I A" : "P R O P O S T A",
      chipLabel: data.preview ? "DOCUMENTO" : "PROPOSTA Nº",
      chipValue: data.proposalNumber,
      chipSub: `Emitido em ${fmtDataLonga(data.createdAt)}`,
    },
  };
  doc.y = drawHeader(doc);

  // Prévia: aviso logo abaixo do cabeçalho. O documento é idêntico ao final
  // de propósito (é pra isso que serve a prévia) -- sem este rótulo, os dois
  // ficam indistinguíveis na mão do cliente.
  if (data.preview) {
    doc.page.drawText(sanitize("PRÉVIA - não é a proposta final"), {
      x: MARGIN,
      y: doc.y - 11,
      size: 9,
      font: fonts.bold,
      color: COLORS.brand,
    });
    doc.y -= 11 + 8;
  }

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
    footerCenter: data.preview
      ? "Prévia de proposta - documento não final"
      : `Proposta comercial - ${data.proposalNumber}`,
  });

  return pdf.save();
}
