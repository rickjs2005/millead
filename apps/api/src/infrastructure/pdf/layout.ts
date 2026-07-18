import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { RGB } from "pdf-lib";

/**
 * Camada de layout de PDF genérica (extraída de contracts/pdf/render.ts,
 * Fase 10 -- ver docs/plano do módulo Briefings pro porquê). Não conhece
 * nada de contrato nem de briefing: quem chama passa strings/valores já
 * prontos. Cuidado ao mexer aqui -- `renderContratoPDF` (contratos, em
 * produção) e `renderBriefingPDF` (briefings) dependem dos MESMOS helpers.
 */

// Paleta compartilhada -- azul MilWeb (#0284c7), usada em todo PDF gerado
// pela plataforma, não só contratos.
export const COLORS = {
  brand: rgb(0.008, 0.518, 0.78),
  ink: rgb(0.043, 0.059, 0.098),
  body: rgb(0.216, 0.255, 0.318),
  muted: rgb(0.42, 0.45, 0.5),
  border: rgb(0.9, 0.91, 0.93),
  brandWeak: rgb(0.918, 0.965, 0.988),
  brandBorder: rgb(0.749, 0.89, 0.957),
  white: rgb(1, 1, 1),
};

// Geometria da página A4.
export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
export const MARGIN = 46;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const TOP_START = PAGE_H - 44; // espelha paddingTop 44
export const BOTTOM_LIMIT = 70; // quebra de página quando y desce abaixo disto

// Helvetica padrão (WinAnsi) não cobre alguns caracteres tipográficos.
// Sanitiza para evitar erro de codificação mantendo a aparência próxima.
export function sanitize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/€/g, "EUR")
    // Catch-all: substitui qualquer caractere fora do WinAnsi (CP1252)
    // por "?" para evitar que drawText/widthOfTextAtSize lancem excecao
    // com dados controlados pelo usuario (emoji, CJK, cirilico, bullets etc.).
    // Mantem \n intacto pois wrapText separa paragrafos por newline.
    // eslint-disable-next-line no-control-regex -- range WinAnsi intencional (preserva \n)
    .replace(/[^\x00-\xff]/g, "?");
}

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

export async function embedFonts(pdf: PDFDocument): Promise<Fonts> {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

// Quebra um parágrafo em linhas respeitando a largura disponível.
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  const paragraphs = sanitize(text).split("\n");
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      // A linha atual nao comporta a palavra: fecha-a primeiro.
      out.push(line);
      line = "";
      // Palavra unica mais larga que maxWidth (ex.: URL sem espacos):
      // quebra por caractere em pedacos que caibam na largura.
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        let chunk = "";
        for (const ch of word) {
          if (chunk && font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        line = chunk;
      } else {
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/** Conteúdo do cabeçalho de marca -- redesenhado no topo de toda página nova. */
export interface HeaderContent {
  brandTitle: string; // ex.: "MilWeb"
  brandSubtitle: string; // ex.: "C O N T R A T O S" / "B R I E F I N G S"
  chipLabel: string; // ex.: "CONTRATO Nº" / "BRIEFING"
  chipValue: string; // ex.: numero do contrato / título do briefing
  chipSub: string; // ex.: "Emitido em 12 de julho de 2026, 14:30"
}

export interface Doc {
  pdf: PDFDocument;
  fonts: Fonts;
  page: PDFPage;
  y: number;
  header: HeaderContent;
}

/** Desenha o cabeçalho de marca no topo da página atual e retorna o y abaixo dele. */
export function drawHeader(doc: Doc): number {
  const { page, fonts, header } = doc;
  const topY = PAGE_H - 44;

  // Selo (retângulo azul-marca) com checkmark branco.
  const sealSize = 24;
  const sealX = MARGIN;
  const sealY = topY - sealSize + 6;
  page.drawRectangle({ x: sealX, y: sealY, width: sealSize, height: sealSize, color: COLORS.brand });
  const cx = sealX + sealSize / 2;
  const cy = sealY + sealSize / 2;
  page.drawLine({
    start: { x: cx - 5, y: cy - 0.5 },
    end: { x: cx - 1.5, y: cy - 4 },
    thickness: 1.8,
    color: COLORS.white,
  });
  page.drawLine({
    start: { x: cx - 1.5, y: cy - 4 },
    end: { x: cx + 5, y: cy + 4 },
    thickness: 1.8,
    color: COLORS.white,
  });

  // Texto da marca.
  const textX = sealX + sealSize + 9;
  page.drawText(sanitize(header.brandTitle), {
    x: textX,
    y: topY - 11,
    size: 12,
    font: fonts.bold,
    color: COLORS.ink,
  });
  page.drawText(sanitize(header.brandSubtitle), {
    x: textX,
    y: topY - 21,
    size: 7,
    font: fonts.regular,
    color: COLORS.muted,
  });

  // Chip à direita (bordado).
  const chipW = 150;
  const chipH = 38;
  const chipX = PAGE_W - MARGIN - chipW;
  const chipY = topY - chipH + 8;
  page.drawRectangle({
    x: chipX,
    y: chipY,
    width: chipW,
    height: chipH,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  });
  const chipPad = 9;
  const chipRight = chipX + chipW - chipPad;
  const drawRight = (text: string, yPos: number, size: number, font: PDFFont, color: RGB) => {
    const s = sanitize(text);
    const w = font.widthOfTextAtSize(s, size);
    page.drawText(s, { x: chipRight - w, y: yPos, size, font, color });
  };
  drawRight(header.chipLabel, chipY + chipH - 11, 6.5, fonts.regular, COLORS.muted);
  drawRight(header.chipValue, chipY + chipH - 23, 11, fonts.bold, COLORS.ink);
  drawRight(header.chipSub, chipY + 6, 7, fonts.regular, COLORS.muted);

  // Linha fina sob o cabeçalho.
  const lineY = sealY - 14;
  page.drawLine({
    start: { x: MARGIN, y: lineY },
    end: { x: PAGE_W - MARGIN, y: lineY },
    thickness: 1,
    color: COLORS.border,
  });

  return lineY - 18;
}

export function addPage(doc: Doc): void {
  doc.page = doc.pdf.addPage([PAGE_W, PAGE_H]);
  doc.y = drawHeader(doc);
}

/** Garante espaço para `needed` pontos; senão, abre nova página. */
export function ensureSpace(doc: Doc, needed: number): void {
  if (doc.y - needed < BOTTOM_LIMIT) {
    addPage(doc);
  }
}

/** Desenha um parágrafo com quebra de linha e de página automáticas. */
export function drawParagraph(
  doc: Doc,
  text: string,
  opts: { size: number; font: PDFFont; color: RGB; lineHeight: number; x?: number; maxWidth?: number },
): void {
  const x = opts.x ?? MARGIN;
  const maxWidth = opts.maxWidth ?? CONTENT_W;
  const lines = wrapText(text, opts.font, opts.size, maxWidth);
  for (const line of lines) {
    ensureSpace(doc, opts.lineHeight);
    doc.page.drawText(line, { x, y: doc.y - opts.size, size: opts.size, font: opts.font, color: opts.color });
    doc.y -= opts.lineHeight;
  }
}

/** Título em negrito + corpo. Evita órfão de título no rodapé da página. */
export function drawClause(doc: Doc, titulo: string, body: string): void {
  // Mantém o título com pelo menos ~2 linhas do corpo na mesma página.
  ensureSpace(doc, 14 + 13 * 2);
  doc.y -= 11; // marginTop
  drawParagraph(doc, titulo, { size: 10, font: doc.fonts.bold, color: COLORS.ink, lineHeight: 14 });
  doc.y -= 1;
  drawParagraph(doc, body, { size: 9.5, font: doc.fonts.regular, color: COLORS.body, lineHeight: 13 });
}

/** Segundo passe: rodapé em todas as páginas com numeração final. */
export function drawFooters(
  pdf: PDFDocument,
  fonts: Fonts,
  opts: { footerLeft: string; footerCenter: string },
): void {
  const pages = pdf.getPages();
  const total = pages.length;
  const footY = 26;
  const left = sanitize(opts.footerLeft);
  const center = sanitize(opts.footerCenter);

  pages.forEach((page, idx) => {
    page.drawLine({
      start: { x: MARGIN, y: footY + 10 },
      end: { x: PAGE_W - MARGIN, y: footY + 10 },
      thickness: 1,
      color: COLORS.border,
    });
    page.drawText(left, { x: MARGIN, y: footY, size: 6.5, font: fonts.regular, color: COLORS.muted });
    const centerW = fonts.regular.widthOfTextAtSize(center, 6.5);
    page.drawText(center, {
      x: PAGE_W / 2 - centerW / 2,
      y: footY,
      size: 6.5,
      font: fonts.regular,
      color: COLORS.muted,
    });
    const num = `${idx + 1}/${total}`;
    const numW = fonts.regular.widthOfTextAtSize(num, 6.5);
    page.drawText(num, {
      x: PAGE_W - MARGIN - numW,
      y: footY,
      size: 6.5,
      font: fonts.regular,
      color: COLORS.muted,
    });
  });
}
