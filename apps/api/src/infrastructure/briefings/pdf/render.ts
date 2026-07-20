import { PDFDocument } from "pdf-lib";
import {
  COLORS,
  CONTENT_W,
  MARGIN,
  PAGE_H,
  PAGE_W,
  TOP_START,
  drawClause,
  drawFooters,
  drawHeader,
  drawParagraph,
  embedFonts,
  ensureSpace,
  sanitize,
  type Doc,
  type Fonts,
} from "../../pdf/layout.js";
import type { BriefingPdfData } from "../../../application/services/briefing-processor.js";
import type { BriefingField } from "../../../domain/entities/briefing.js";

const EMPTY = "—";

function displayValue(field: BriefingField, valueText: string | null, valueJson: unknown): string {
  if (field.type === "MULTI_SELECT" && Array.isArray(valueJson)) {
    return valueJson.length ? valueJson.join(", ") : EMPTY;
  }
  return valueText?.trim() || EMPTY;
}

/** Renderiza o briefing concluído em PDF, organizado por seção. */
export async function renderBriefingPDF(data: BriefingPdfData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(data.briefingTitle);
  pdf.setAuthor("MilWeb");

  const fonts: Fonts = await embedFonts(pdf);
  const firstPage = pdf.addPage([PAGE_W, PAGE_H]);
  const doc: Doc = {
    pdf,
    fonts,
    page: firstPage,
    y: TOP_START,
    header: {
      brandTitle: "MilWeb",
      brandSubtitle: "B R I E F I N G S",
      chipLabel: "BRIEFING",
      chipValue: data.templateName,
      chipSub: `Concluído em ${data.completedAt}`,
    },
  };
  doc.y = drawHeader(doc);

  // Título + resumo de contato.
  doc.page.drawText(sanitize(data.briefingTitle), {
    x: MARGIN,
    y: doc.y - 15,
    size: 15,
    font: fonts.bold,
    color: COLORS.ink,
  });
  doc.y -= 15 + 6;
  doc.page.drawRectangle({ x: MARGIN, y: doc.y - 3, width: 42, height: 3, color: COLORS.brand });
  doc.y -= 3 + 14;

  const contatoLinhas = [
    data.contactName ? `Nome: ${data.contactName}` : null,
    data.contactEmail ? `E-mail: ${data.contactEmail}` : null,
    data.contactPhone ? `Telefone: ${data.contactPhone}` : null,
  ].filter((v): v is string => Boolean(v));
  if (contatoLinhas.length > 0) {
    drawParagraph(doc, contatoLinhas.join("   ·   "), {
      size: 9,
      font: fonts.regular,
      color: COLORS.muted,
      lineHeight: 13,
    });
    doc.y -= 6;
  }

  // Índice de respostas por fieldId (topo) e por groupItemId (itens de GROUP).
  const byFieldId = new Map(
    data.answers.filter((a) => a.groupItemId === "").map((a) => [a.fieldId, a]),
  );
  const byChild = new Map<string, typeof data.answers>();
  for (const a of data.answers) {
    if (a.groupItemId === "") continue;
    const list = byChild.get(a.fieldId) ?? [];
    list.push(a);
    byChild.set(a.fieldId, list);
  }
  const filesById = new Map(data.files.map((f) => [f.id, f]));

  for (const section of data.template.sections) {
    ensureSpace(doc, 26);
    doc.y -= 10;
    drawParagraph(doc, section.title.toUpperCase(), {
      size: 10.5,
      font: fonts.bold,
      color: COLORS.brand,
      lineHeight: 16,
    });

    for (const field of section.fields) {
      if (field.type === "GROUP") {
        const children = field.children ?? [];
        const itemIds = [
          ...new Set(children.flatMap((c) => (byChild.get(c.id) ?? []).map((a) => a.groupItemId))),
        ];
        if (itemIds.length === 0) {
          drawClause(doc, field.label, `Nenhum item adicionado.`);
          continue;
        }
        drawClause(doc, `${field.label} (${itemIds.length})`, "");
        itemIds.forEach((itemId, idx) => {
          const parts = children.map((child) => {
            const answer = (byChild.get(child.id) ?? []).find((a) => a.groupItemId === itemId);
            if (child.type === "FILE" && Array.isArray(answer?.valueJson)) {
              const names = (answer.valueJson as string[])
                .map((fid) => filesById.get(fid)?.originalName)
                .filter(Boolean);
              return `${child.label}: ${names.length ? names.join(", ") : EMPTY}`;
            }
            return `${child.label}: ${displayValue(child, answer?.valueText ?? null, answer?.valueJson)}`;
          });
          drawParagraph(doc, `${idx + 1}. ${parts.join("  |  ")}`, {
            size: 9,
            font: fonts.regular,
            color: COLORS.body,
            lineHeight: 13,
            x: MARGIN + 10,
            maxWidth: CONTENT_W - 10,
          });
        });
        doc.y -= 4;
        continue;
      }

      if (field.type === "FILE") {
        const answer = byFieldId.get(field.id);
        const names = Array.isArray(answer?.valueJson)
          ? (answer.valueJson as string[])
              .map((fid) => filesById.get(fid)?.originalName)
              .filter(Boolean)
          : [];
        drawClause(doc, field.label, names.length ? names.join(", ") : "Nenhum arquivo enviado.");
        continue;
      }

      const answer = byFieldId.get(field.id);
      drawClause(
        doc,
        field.label,
        displayValue(field, answer?.valueText ?? null, answer?.valueJson),
      );
    }
  }

  // Anexos.
  if (data.files.length > 0) {
    ensureSpace(doc, 26);
    doc.y -= 10;
    drawParagraph(doc, `ANEXOS (${data.files.length})`, {
      size: 10.5,
      font: fonts.bold,
      color: COLORS.brand,
      lineHeight: 16,
    });
    for (const file of data.files) {
      const kb = Math.max(1, Math.round(file.sizeBytes / 1024));
      drawParagraph(doc, `• ${file.originalName} (${kb} KB)`, {
        size: 9,
        font: fonts.regular,
        color: COLORS.body,
        lineHeight: 13,
      });
    }
  }

  drawFooters(pdf, fonts, {
    footerLeft: "MilWeb",
    footerCenter: `Registro de briefing - ${data.briefingTitle}`,
  });

  return Buffer.from(await pdf.save());
}
