import type {
  BriefingField,
  BriefingSection,
  BriefingTemplateDetail,
} from "../../domain/entities/briefing.js";

type FieldRow = {
  id: string;
  sectionId: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  type: string;
  order: number;
  required: boolean;
  helpText: string | null;
  config: unknown;
};

type SectionRow = {
  id: string;
  templateId: string;
  key: string;
  title: string;
  description: string | null;
  order: number;
  fields: FieldRow[];
};

type TemplateRow = {
  id: string;
  key: string;
  kind: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sections: SectionRow[];
};

/** Reconstrói a árvore GROUP->filhos a partir da lista achatada do Prisma. */
export function toFieldTree(rows: FieldRow[]): BriefingField[] {
  const byId = new Map<string, BriefingField>();
  for (const row of rows) {
    byId.set(row.id, { ...row, type: row.type as BriefingField["type"], children: [] });
  }
  const roots: BriefingField[] = [];
  for (const row of rows) {
    const field = byId.get(row.id)!;
    if (row.parentFieldId) {
      byId.get(row.parentFieldId)?.children?.push(field);
    } else {
      roots.push(field);
    }
  }
  return roots.sort((a, b) => a.order - b.order);
}

export function toSection(row: SectionRow): BriefingSection {
  return {
    id: row.id,
    templateId: row.templateId,
    key: row.key,
    title: row.title,
    description: row.description,
    order: row.order,
    fields: toFieldTree(row.fields),
  };
}

export function toTemplateDetail(row: TemplateRow): BriefingTemplateDetail {
  const { sections, ...template } = row;
  return {
    ...template,
    kind: template.kind as BriefingTemplateDetail["kind"],
    sections: sections.map(toSection),
  };
}

/** Include padrão do Prisma pra carregar um template completo (seções + campos, ordenados). */
export const templateInclude = {
  sections: {
    orderBy: { order: "asc" as const },
    include: { fields: { orderBy: { order: "asc" as const } } },
  },
};
