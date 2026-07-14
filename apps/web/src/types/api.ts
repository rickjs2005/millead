/**
 * Tipos espelhando exatamente as respostas da API do MilLead
 * (apps/api/src/application/dto e domain/entities). Fonte única de
 * verdade do lado do frontend -- qualquer mudança de shape no backend
 * precisa ser refletida aqui.
 */

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type PermissionKey =
  | "leads:read"
  | "leads:write"
  | "leads:delete"
  | "companies:read"
  | "companies:write"
  | "pipelines:manage"
  | "tasks:read"
  | "tasks:write"
  | "meetings:read"
  | "meetings:write"
  | "proposals:read"
  | "proposals:write"
  | "audits:read"
  | "audits:write"
  | "messages:read"
  | "messages:write"
  | "members:manage"
  | "roles:manage"
  | "billing:manage"
  | "settings:manage";

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationRef {
  id: string;
  name: string;
  slug: string;
}

export interface RoleRef {
  id: string;
  name: string;
  permissions: PermissionKey[];
}

export interface SessionResult {
  user: PublicUser;
  organization: OrganizationRef;
  role: RoleRef;
  accessToken: string;
  refreshToken: string;
}

export interface OrganizationChoiceRequired {
  requiresOrganizationSelection: true;
  organizations: (OrganizationRef & { roleName: string })[];
}

export interface CurrentUserResult {
  user: PublicUser;
  organization: OrganizationRef;
  role: RoleRef;
}

// ---------- Companies ----------

export type SocialPlatform =
  "INSTAGRAM" | "FACEBOOK" | "LINKEDIN" | "TIKTOK" | "WHATSAPP" | "OTHER";

export interface Company {
  id: string;
  organizationId: string;
  name: string;
  document: string | null;
  segment: string | null;
  sizeEstimate: string | null;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyWebsite {
  id: string;
  companyId: string;
  url: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface CompanySocial {
  id: string;
  companyId: string;
  platform: SocialPlatform;
  handleOrUrl: string;
  createdAt: string;
}

export interface CompanyDetail extends Company {
  websites: CompanyWebsite[];
  socials: CompanySocial[];
}

// ---------- Leads ----------

export type LeadSource = "MANUAL" | "IMPORT" | "SCRAPER" | "REFERRAL" | "INBOUND";
export type LeadStatus = "OPEN" | "WON" | "LOST";

export interface Lead {
  id: string;
  organizationId: string;
  companyId: string | null;
  pipelineStageId: string | null;
  ownerId: string | null;
  title: string;
  source: LeadSource;
  status: LeadStatus;
  score: number | null;
  value: string | null;
  currency: string;
  lostReason: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadContact {
  id: string;
  leadId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorId: string | null;
  body: string;
  createdAt: string;
}

export interface LeadTagRef {
  id: string;
  name: string;
  color: string;
}

export interface LeadDetail extends Lead {
  contacts: LeadContact[];
  notes: LeadNote[];
  tags: LeadTagRef[];
}

export interface Tag {
  id: string;
  organizationId: string;
  name: string;
  color: string;
  createdAt: string;
}

export type ActivityType =
  | "NOTE"
  | "CALL"
  | "EMAIL"
  | "STATUS_CHANGE"
  | "TASK_CREATED"
  | "MEETING_SCHEDULED"
  | "MESSAGE_SENT"
  | "PROPOSAL_SENT"
  | "OTHER";

export interface Activity {
  id: string;
  organizationId: string;
  leadId: string | null;
  userId: string | null;
  type: ActivityType;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

// ---------- Pipeline ----------

export interface PipelineStage {
  id: string;
  organizationId: string;
  pipelineId: string;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
  createdAt: string;
}

export interface Pipeline {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

// ---------- Tasks ----------

export type TaskStatus = "PENDING" | "DONE" | "CANCELLED";

export interface Task {
  id: string;
  organizationId: string;
  leadId: string | null;
  assigneeId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Meetings ----------

export type MeetingLocation = "ONLINE" | "IN_PERSON" | "PHONE";
export type MeetingStatus = "SCHEDULED" | "COMPLETED" | "CANCELED" | "NO_SHOW";

export interface Meeting {
  id: string;
  organizationId: string;
  leadId: string | null;
  createdById: string | null;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  location: MeetingLocation;
  meetingUrl: string | null;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAttendee {
  id: string;
  meetingId: string;
  userId: string | null;
  name: string;
  email: string | null;
  isInternal: boolean;
}

export interface MeetingDetail extends Meeting {
  attendees: MeetingAttendee[];
}

// ---------- Proposals ----------

export type ProposalStatus = "DRAFT" | "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED";

export interface Proposal {
  id: string;
  organizationId: string;
  leadId: string;
  createdById: string | null;
  title: string;
  status: ProposalStatus;
  value: string;
  currency: string;
  validUntil: string | null;
  pdfUrl: string | null;
  sentAt: string | null;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------- Audits (auditoria de SITE, Fase 6) ----------

export type AuditStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
export type AuditTrigger = "MANUAL" | "AUTOMATIC";
export type AuditScoreCategory =
  | "PERFORMANCE"
  | "SEO"
  | "ACCESSIBILITY"
  | "SECURITY"
  | "DESIGN"
  | "MOBILE";

/** Uma checagem individual dentro de AuditScore.details.checks. */
export interface AuditCheck {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  info?: string;
}

export interface AuditScore {
  id: string;
  organizationId: string;
  auditId: string;
  category: AuditScoreCategory;
  score: number;
  details: { checks?: AuditCheck[] } | null;
  createdAt: string;
}

export interface AuditReport {
  id: string;
  organizationId: string;
  auditId: string;
  summary: string | null;
  rawData: unknown;
  pdfUrl: string | null;
  createdAt: string;
}

/** A API sempre devolve a auditoria com report + scores embutidos. */
export interface Audit {
  id: string;
  organizationId: string;
  companyId: string;
  requestedById: string | null;
  status: AuditStatus;
  triggeredBy: AuditTrigger;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  report: AuditReport | null;
  scores: AuditScore[];
}

// ---------- Mensagens (Fase 7) ----------

export type MessageChannel = "WHATSAPP" | "EMAIL" | "SMS";
export type MessageDirection = "OUTBOUND" | "INBOUND";
export type MessageStatus = "DRAFT" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";

export interface Message {
  id: string;
  organizationId: string;
  leadId: string;
  templateId: string | null;
  channel: MessageChannel;
  direction: MessageDirection;
  status: MessageStatus;
  body: string;
  sentAt: string | null;
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  organizationId: string;
  name: string;
  channel: MessageChannel;
  subject: string | null;
  body: string;
  variables: unknown;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---------- IA (Fase 7) ----------

export interface AiStatus {
  enabled: boolean;
}

export interface LeadScoreResponse {
  score: number;
  rationale: string;
  lead: Lead;
}

export interface LeadReportResponse {
  report: string;
}

// ---------- Landing Pages (Fase 8) ----------

export type LandingPageKind = "DEMO_SITE" | "PITCH";
export type LandingPageStatus = "QUEUED" | "GENERATING" | "READY" | "FAILED";

/** Listagem vem sem o HTML (pesado); o detalhe (GET /:id) inclui `html`. */
export interface LandingPage {
  id: string;
  organizationId: string;
  companyId: string;
  leadId: string | null;
  createdById: string | null;
  slug: string;
  title: string;
  kind: LandingPageKind;
  status: LandingPageStatus;
  brief: string | null;
  errorMessage: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
  hasHtml?: boolean;
  html?: string | null;
}

// ---------- Erros ----------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}
