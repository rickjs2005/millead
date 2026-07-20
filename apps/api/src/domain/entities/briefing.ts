import type { BriefingFieldType, BriefingStatus, BriefingTemplateKind } from "@millead/database";

export interface BriefingTemplate {
  id: string;
  key: string;
  kind: BriefingTemplateKind;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface BriefingField {
  id: string;
  sectionId: string;
  parentFieldId: string | null;
  key: string;
  label: string;
  type: BriefingFieldType;
  order: number;
  required: boolean;
  helpText: string | null;
  config: unknown;
  /** Só populado quando type === "GROUP". */
  children?: BriefingField[];
}

export interface BriefingSection {
  id: string;
  templateId: string;
  key: string;
  title: string;
  description: string | null;
  order: number;
  fields: BriefingField[];
}

/** Template com seções/campos aninhados e ordenados -- o que o wizard consome. */
export interface BriefingTemplateDetail extends BriefingTemplate {
  sections: BriefingSection[];
}

export interface Briefing {
  id: string;
  organizationId: string;
  templateId: string;
  /** Populado na LISTAGEM (o catálogo de templates exclui CUSTOM de
   * propósito, então a lista admin não conseguia derivar o kind sozinha). */
  templateKind?: BriefingTemplateKind;
  leadId: string | null;
  companyId: string | null;
  createdById: string | null;
  status: BriefingStatus;
  progressPercent: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pdfUrl: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BriefingLink {
  id: string;
  briefingId: string;
  token: string;
  /** Link expira 24h após a criação; null só nos links antigos (sem expiração). */
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/** Resposta de UM campo. `groupItemId` === "" para campo de topo -- ver
 * comentário do model no schema.prisma pro porquê da sentinela. */
export interface BriefingAnswer {
  id: string;
  briefingId: string;
  fieldId: string;
  groupItemId: string;
  groupItemOrder: number | null;
  valueText: string | null;
  valueJson: unknown;
  updatedAt: Date;
}

export interface BriefingFile {
  id: string;
  briefingId: string;
  blobUrl: string;
  pathname: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}

export interface BriefingHistoryEntry {
  id: string;
  briefingId: string;
  tipo: string;
  /** APP | PUBLIC_FORM | WORKER */
  origem: string;
  payload: unknown;
  createdAt: Date;
}

/** O que a tela de detalhe admin e o wizard público carregam de uma vez. */
export interface BriefingDetail extends Briefing {
  template: BriefingTemplateDetail;
  link: BriefingLink | null;
  answers: BriefingAnswer[];
  files: BriefingFile[];
  history: BriefingHistoryEntry[];
}
