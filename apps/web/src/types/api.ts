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
  | "settings:manage"
  | "project-checklists:read"
  | "project-checklists:write";

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

// ---------- Equipe ----------

export type MembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

export interface TeamRole extends RoleRef {
  organizationId: string;
  description: string | null;
  isSystem: boolean;
}

export interface TeamMember {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  userIsActive: boolean;
  lastLoginAt: string | null;
  status: MembershipStatus;
  invitedAt: string | null;
  joinedAt: string | null;
  createdAt: string;
  role: TeamRole;
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: TeamRole;
  organization: OrganizationRef;
  invitedById: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamInvitationPreview {
  email: string;
  organization: OrganizationRef;
  role: { id: string; name: string };
  expiresAt: string;
  existingAccount: boolean;
}

// ---------- Integrações (status da plataforma) ----------

export type IntegrationStatusLevel = "connected" | "disabled" | "not_configured";

export interface IntegrationStatus {
  key: "email" | "whatsapp" | "signature" | "ai";
  name: string;
  status: IntegrationStatusLevel;
  description: string;
  detail: string | null;
}

export interface IntegrationsStatusResult {
  integrations: IntegrationStatus[];
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
  | "BRIEFING_SENT"
  | "BRIEFING_COMPLETED"
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
  // Aceite público (/p/:token)
  publicToken: string | null;
  viewedAt: string | null;
  decidedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Detalhe autenticado de uma proposta (`GET /api/v1/proposals/:id`) --
 * `contractId` é o contrato já gerado a partir dela (aceite -> contrato
 * herdado), null se ainda não houver. Só existe no detalhe, não na listagem. */
export interface ProposalDetail extends Proposal {
  contractId: string | null;
}

/** Resposta pública da proposta (`/p/[token]`). Projeção enxuta de Proposal:
 * nome da organização em vez de IDs internos, sem leadId/createdById. */
export type PublicProposalStatus = Exclude<ProposalStatus, "DRAFT">;

export interface PublicProposal {
  title: string;
  value: string;
  currency: string;
  validUntil: string | null;
  organizationName: string;
  pdfUrl: string | null;
  scopeItems: string[];
  status: PublicProposalStatus;
}

// ---------- Audits (auditoria de SITE, Fase 6) ----------

export type AuditStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
export type AuditTrigger = "MANUAL" | "AUTOMATIC";
export type AuditScoreCategory =
  "PERFORMANCE" | "SEO" | "ACCESSIBILITY" | "SECURITY" | "DESIGN" | "MOBILE";

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

// ---------- Contratos (Fase 9) ----------

export type ContractType = "SITE" | "SISTEMA" | "SAAS" | "MANUTENCAO" | "CONSULTORIA";
export type ContractPaymentMethod = "PIX" | "BOLETO" | "CARTAO" | "TRANSFERENCIA" | "PARCELADO";
export type ContractStatus =
  | "RASCUNHO"
  | "VALIDADO"
  | "PDF_GERADO"
  | "AGUARDANDO_ASSINATURA"
  | "ASSINADO"
  | "CANCELADO"
  | "EXPIRADO";

export interface ContractorSnapshot {
  tipoPessoa: "PF" | "PJ";
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  nomeEmpresa?: string | null;
}

export interface Contract {
  id: string;
  organizationId: string;
  companyId: string;
  leadId: string | null;
  createdById: string | null;
  numero: string;
  tipo: ContractType;
  status: ContractStatus;
  descricaoProjeto: string;
  valorTotal: string;
  formaPagamento: ContractPaymentMethod;
  percentualEntrada: string;
  prazoEntregaDias: number;
  limiteRevisoes: number;
  contractorSnapshot: ContractorSnapshot;
  contractedSnapshot: unknown;
  /** Orçamento que originou o contrato (aceite -> contrato herdado); null
   * quando o contrato foi criado direto, sem orçamento. Alimenta a margem
   * realizada (contas a receber) -- só é possível projetar custo com isso. */
  proposalId: string | null;
  provider: string;
  signatureDocId: string | null;
  signatureUrl: string | null;
  assinadoEm: string | null;
  hasPdfOriginal: boolean;
  hasPdfAssinado: boolean;
  /** Último evento é FALHA_PROCESSAMENTO: parou de vez, não adianta esperar. */
  falhouProcessamento: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractSigner {
  id: string;
  contractId: string;
  nome: string;
  email: string;
  papel: string;
  assinadoEm: string | null;
  ip: string | null;
  createdAt: string;
}

export interface ContractEvent {
  id: string;
  contractId: string;
  tipo: string;
  origem: string;
  payload: unknown;
  createdAt: string;
}

export interface ContractDetail extends Contract {
  signers: ContractSigner[];
  events: ContractEvent[];
}

export interface ContractKpis {
  total: number;
  aguardandoAssinatura: number;
  assinados: number;
  valorFechado: string;
  /** Soma de `valorTotal` dos contratos assinados no mês corrente. */
  valorFechadoMes: string;
  /** Soma de `valorTotal` dos contratos assinados no ano corrente. */
  valorFechadoAno: string;
}

/** Resumo financeiro dos leads ganhos -- `wonWithoutContract*` exclui leads
 * com contrato assinado (a receita desses já está em ContractKpis.valorFechado). */
export interface LeadFinance {
  wonCount: number;
  wonSum: string;
  wonWithoutContractCount: number;
  wonWithoutContractSum: string;
}

// ---------- Briefings ----------

export type BriefingTemplateKind = "INSTITUCIONAL" | "ECOMMERCE" | "CUSTOM";
export type BriefingFieldType =
  "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "URL" | "SELECT" | "MULTI_SELECT" | "FILE" | "GROUP";
export type BriefingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED";

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

export interface BriefingTemplateDetail extends BriefingTemplate {
  sections: BriefingSection[];
}

export interface Briefing {
  id: string;
  organizationId: string;
  templateId: string;
  /** Populado na listagem (o catálogo exclui CUSTOM, então a lista não
   * conseguia derivar o kind do briefing personalizado sozinha). */
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
  startedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BriefingLink {
  id: string;
  briefingId: string;
  token: string;
  /** Link expira 24h após a criação; null só nos links antigos (sem expiração). */
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface BriefingAnswer {
  id: string;
  briefingId: string;
  fieldId: string;
  groupItemId: string;
  groupItemOrder: number | null;
  valueText: string | null;
  valueJson: unknown;
  updatedAt: string;
}

export interface BriefingFile {
  id: string;
  briefingId: string;
  blobUrl: string;
  pathname: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BriefingHistoryEntry {
  id: string;
  briefingId: string;
  tipo: string;
  origem: string;
  payload: unknown;
  createdAt: string;
}

export interface BriefingDetail extends Briefing {
  template: BriefingTemplateDetail;
  link: BriefingLink | null;
  answers: BriefingAnswer[];
  files: BriefingFile[];
  history: BriefingHistoryEntry[];
}

/** Resposta pública do formulário (wizard). Projeção enxuta de BriefingDetail:
 * só o que o wizard precisa, SEM dados internos (organizationId, leadId,
 * companyId, createdById, histórico) que não pertencem a quem tem o link. */
export interface PublicBriefing {
  id: string;
  status: BriefingStatus;
  progressPercent: number;
  template: BriefingTemplateDetail;
  answers: BriefingAnswer[];
  files: BriefingFile[];
}

// ---------- Financeiro (Fase 1) ----------

export type CostScope = "AGENCY" | "CLIENT";
export type CostCurrency = "BRL" | "USD";
export type CostBillingCycle = "MONTHLY" | "YEARLY";
export type CostCategory =
  "HOSTING" | "DATABASE" | "AI" | "DOMAIN" | "EMAIL" | "SIGNATURE" | "OTHER";

export interface CostSubscription {
  id: string;
  organizationId: string;
  companyId: string | null;
  serviceKey: string | null;
  name: string;
  scope: CostScope;
  amount: string;
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  capacityLimit: number | null;
  capacityUsed: number | null;
  creditsIncluded: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CostServiceCatalogItem {
  id: string;
  key: string;
  name: string;
  category: CostCategory;
  defaultAmount: string;
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  defaultScope: CostScope;
  defaultCapacityLimit: number | null;
  bestFor: string | null;
  billingNotes: string | null;
}

export interface FinanceSettings {
  id: string;
  organizationId: string;
  usdToBrlRate: string;
  /** true = cotação atualizada automaticamente (lazy, na leitura de settings)
   * via API externa; editar `usdToBrlRate` manualmente desliga isso no backend. */
  usdRateAuto: boolean;
  /** Instante da última atualização automática; null se nunca atualizou (ou modo manual). */
  usdRateUpdatedAt: string | null;
  defaultHourlyRate: string;
  supportReservePct: string;
  defaultMarginPct: string;
  activeClientsCount: number;
}

/** Uma assinatura com capacidade (ex.: tokens/mês) aproximando do limite. */
export interface CapacityEntry {
  id: string;
  name: string;
  used: number;
  limit: number;
  pct: number;
}

export interface CostSummary {
  agencyMonthlyBrl: number;
  clientMonthlyBrl: number;
  totalMonthlyBrl: number;
  perClientShareBrl: number;
  activeClientsCount: number;
  wonLeadsCount: number;
  activeSubscriptions: number;
  capacity: CapacityEntry[];
  maxCapacityPct: number | null;
}

export interface CostSubscriptionPayload {
  name: string;
  scope: CostScope;
  amount: number;
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  serviceKey?: string | null;
  companyId?: string | null;
  capacityLimit?: number | null;
  capacityUsed?: number | null;
  creditsIncluded?: number | null;
  isActive?: boolean;
  notes?: string | null;
}

export interface FinanceSettingsPayload {
  usdToBrlRate?: number;
  /** Envie `true` pra religar a atualização automática; enviar `usdToBrlRate`
   * sem isso desliga o auto no backend (edição manual = quer manual). */
  usdRateAuto?: boolean;
  defaultHourlyRate?: number;
  supportReservePct?: number;
  defaultMarginPct?: number;
  activeClientsCount?: number;
}

// ---------- Consumo de créditos (Financeiro Fase 5) ----------

/** Lançamento de consumo de créditos -- `companyName` já vem denormalizado
 * da leitura (join com Company), null quando sem cliente. */
export interface CostUsageEntry {
  id: string;
  organizationId: string;
  subscriptionId: string;
  companyId: string | null;
  companyName: string | null;
  credits: number;
  usedAt: string;
  note: string | null;
  createdAt: string;
  unitPriceBrl: number | null;
}

/** Resumo de consumo de créditos de um mês (`GET /costs/usage/summary`). */
export interface UsageSummary {
  month: string; // "2026-07"
  /** Preço unitário quando há exatamente 1 assinatura com creditsIncluded
   * usada no mês; null se ambíguo/nenhum -- ver o detalhe em `bySubscription`. */
  unitPriceBrl: number | null;
  totalCredits: number;
  bySubscription: {
    subscriptionId: string;
    name: string;
    credits: number;
    creditsIncluded: number | null;
    unitPriceBrl: number | null;
    costBrl: number;
  }[];
  /** companyId null => "Sem cliente". */
  byClient: { companyId: string | null; companyName: string; credits: number; costBrl: number }[];
}

/** Um mês da série de consumo (`GET /costs/usage/series`) -- sempre presente
 * mesmo sem lançamento no mês (zero-fill), 0 nesse caso. Diferente de
 * `ReceivableSeriesPoint`, os valores já vêm como number (não Decimal). */
export interface CostUsageSeriesPoint {
  month: string; // "YYYY-MM"
  usageCostBrl: number;
  /** Soma das assinaturas ativas cuja `createdAt` <= fim do mês -- aproximação
   * documentada (sem histórico de cancelamento, ver `CostUsageSeries`). */
  recurringCostBrl: number;
  /** `usageCostBrl + recurringCostBrl` deste mês. */
  totalCostBrl: number;
}

/** Série mensal de consumo + totais (`GET /costs/usage/series?months=N`).
 * `months` vem em ordem ascendente, sempre com N entradas (zero-fill).
 * `recurringMonthlyBrl` é o custo fixo ATUAL (mesma conta de `CostSummary.totalMonthlyBrl`,
 * mantido por compatibilidade) -- `recurringCostBrl` por mês em `months[]` é a
 * aproximação real (assinatura ativa conta a partir da sua `createdAt`;
 * inativa não conta em mês nenhum -- sem data de cancelamento conhecida). */
export interface CostUsageSeries {
  months: CostUsageSeriesPoint[];
  yearTotal: number;
  recurringMonthlyBrl: number;
  /** Soma de `recurringCostBrl` de todos os meses da série. */
  yearRecurringTotal: number;
  /** `yearTotal + yearRecurringTotal` -- custo total do ano (consumo + assinaturas). */
  yearGrandTotal: number;
}

export interface CreateUsageEntryPayload {
  subscriptionId: string;
  companyId?: string | null;
  credits: number;
  usedAt: string;
  note?: string | null;
}

// ---------- Calculadora de Orçamentos (Financeiro Fase 2) ----------

export type EstimateStatus = "DRAFT" | "READY" | "CONVERTED";
export type EstimateStatusWrite = "DRAFT" | "READY"; // CONVERTED só via endpoint de conversão (Fase 3)

export interface HoursLine {
  label: string;
  hours: number;
}

export interface EstimateCostItem {
  id: string;
  organizationId: string;
  estimateId: string;
  subscriptionId: string | null;
  label: string;
  amount: string; // Decimal do Prisma serializa como string
  currency: CostCurrency;
  billingCycle: CostBillingCycle;
  /** Custo único (ex.: créditos de projeto) -- não multiplica por infraMonths. */
  isOneTime: boolean;
}

/** Espelho de EstimateComputed em apps/api/src/application/services/estimate-calc.ts. */
export interface EstimateComputed {
  totalHours: number;
  devCost: number;
  infraMonthlyBrl: number;
  /** Soma 1x dos itens `isOneTime` (ex.: créditos estimados de projeto). */
  oneTimeCost: number;
  infraCost: number;
  supportReserve: number;
  /** (domainYears ?? 0) × domainYearPriceBrl -- campo próprio, NÃO entra em infraCost/oneTimeCost. */
  domainCost: number;
  totalCost: number;
  priceMin: number;
  priceRecommended: number;
  pricePremium: number;
}

export interface PricingEstimate {
  id: string;
  organizationId: string;
  leadId: string | null;
  createdById: string;
  productId: string | null;
  proposalId: string | null;
  title: string;
  status: EstimateStatus;
  hourlyRate: string; // Decimal do Prisma serializa como string
  hoursBreakdown: HoursLine[];
  agencyShareMonthly: string; // Decimal do Prisma serializa como string
  infraMonths: number;
  supportReservePct: string; // Decimal do Prisma serializa como string
  marginPct: string; // Decimal do Prisma serializa como string
  scopeItems: string[];
  deadlineDays: number;
  paymentTerms: string;
  validDays: number;
  // Fase 6: preço final decidido pelo dono e domínio por anos -- ambos
  // opcionais, Decimal do Prisma serializa como string, null quando ausente.
  finalPrice: string | null;
  domainYears: number | null;
  domainYearPriceBrl: string | null;
  createdAt: string;
  updatedAt: string;
  costItems: EstimateCostItem[];
  computed: EstimateComputed;
}

export interface ProjectProduct {
  id: string;
  organizationId: string | null;
  name: string;
  priceMin: string; // Decimal do Prisma serializa como string
  priceMax: string; // Decimal do Prisma serializa como string
  baseHours: number | null;
  description: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateCostItemPayload {
  label: string;
  amount: number;
  currency?: CostCurrency;
  billingCycle?: CostBillingCycle;
  subscriptionId?: string | null;
  /** Ausente equivale a false (item recorrente/mensal). */
  isOneTime?: boolean;
}

export interface EstimatePayload {
  title: string;
  leadId?: string | null;
  productId?: string | null;
  hourlyRate: number;
  hoursBreakdown: HoursLine[];
  costItems: EstimateCostItemPayload[];
  agencyShareMonthly?: number;
  infraMonths: number;
  supportReservePct: number;
  marginPct: number;
  scopeItems: string[];
  deadlineDays: number;
  paymentTerms: string;
  validDays: number;
  status?: EstimateStatusWrite;
  // Fase 6: preço final decidido pelo dono e domínio por anos -- ambos
  // opcionais/nullable (null desvincula/limpa no update).
  finalPrice?: number | null;
  domainYears?: number | null;
  domainYearPriceBrl?: number | null;
}

/** Lista paginada de orçamentos -- a API devolve só `{items, total}`, sem
 * page/pageSize/totalPages (diferente de `PaginatedResult<T>`). */
export interface EstimatesListResult {
  items: PricingEstimate[];
  total: number;
}

/** Resposta de POST /api/v1/estimates/:id/convert (Fase 3) -- espelha o
 * retorno de `EstimateService.convert` (apps/api/src/application/services/estimate-service.ts). */
export interface ConvertEstimateResult {
  estimate: PricingEstimate;
  proposalId: string;
  pdfUrl: string;
}

// ---------- Erros ----------

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

// ===== MilSocial (ferramenta interna do dono) =====

export type SocialPostFormat =
  | "UNCLASSIFIED"
  | "REDESIGN"
  | "BEFORE_AFTER"
  | "TIMELAPSE"
  | "REVIEW"
  | "ANIMATION"
  | "CODE_SETUP"
  | "OTHER";

export interface SocialMetricSnapshot {
  id: string;
  postId: string;
  collectedAt: string;
  reach: number | null;
  views: number | null;
  avgWatchTimeMs: number | null;
  totalWatchTimeMs: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  profileVisits: number | null;
  profileActivity: number | null;
}

export interface SocialPostWithMetrics {
  id: string;
  igMediaId: string;
  igPermalink: string;
  mediaType: string;
  caption: string | null;
  thumbnailUrl: string | null;
  publishedAt: string;
  format: SocialPostFormat;
  formatSource: "NONE" | "AI" | "MANUAL";
  latest: SocialMetricSnapshot | null;
}

export interface FormatComparisonRow {
  format: SocialPostFormat;
  postCount: number;
  avgReach: number | null;
  avgViews: number | null;
  avgWatchTimeMs: number | null;
  avgInteractions: number | null;
  avgProfileVisits: number | null;
}

export interface SocialSyncResult {
  postsCreated: number;
  postsUpdated: number;
  snapshotsSaved: number;
  classified: number;
  tokenRefreshed: boolean;
  /** Posts cujos insights falharam nesta rodada (ficaram sem snapshot novo). */
  insightsFailed: number;
  /** Classificações por IA que falharam. Sem IA configurada, sempre 0. */
  classificationFailed: number;
}

export interface SocialAnalysis {
  report: string;
  suggestions: string[];
}

// ---------- Contas a receber (Fase 10) ----------

export type ReceivableKind = "ENTRADA" | "PARCELA" | "AVULSA";

export interface Receivable {
  id: string;
  organizationId: string;
  /** null quando `kind === "AVULSA"` -- receita sem contrato vinculado. */
  contractId: string | null;
  kind: ReceivableKind;
  /** 0 = entrada ou avulsa, 1..N = parcelas. */
  installmentIndex: number;
  amount: string; // Decimal do Prisma serializa como string
  dueDate: string; // date-only na prática -- exibir com timeZone UTC
  paidAt: string | null; // instante -- exibir no fuso America/Sao_Paulo
  paidNote: string | null;
  /** Só populado em receitas avulsas (`kind === "AVULSA"`); null nas parcelas de contrato. */
  description: string | null;
}

/** Contrato + totais agregados de parcelas (`GET /receivables` sem contractId). */
export interface ContractWithTotals {
  contractId: string;
  numero: string;
  companyName: string;
  total: string;
  paid: string;
  openOverdue: string;
  nextDueDate: string | null;
}

/** Resumo do mês (`GET /receivables/summary`). */
export interface ReceivableSummary {
  month: string; // "2026-08"
  toReceive: string; // em aberto com vencimento no mês
  overdue: string; // em aberto vencidas (qualquer data passada)
  overdueItems: Receivable[];
  received: string; // pagas com paidAt no mês
}

/** Margem realizada de um contrato (`GET /receivables/margin`) -- `projectedCost`/
 * `realizedMargin` só existem quando o contrato tem `proposalId` (orçamento). */
export interface ContractMargin {
  contractId: string;
  soldValue: string;
  received: string;
  projectedCost: string | null;
  realizedMargin: string | null;
}

/** Um mês da série (`GET /receivables/summary/series`) -- sempre presente
 * mesmo sem movimento no mês (zero-fill), "0" nesse caso. */
export interface ReceivableSeriesPoint {
  month: string; // "YYYY-MM"
  received: string; // Decimal do Prisma serializa como string
  expected: string; // Decimal do Prisma serializa como string
}

/** Série mensal + totais do ano corrente (`GET /receivables/summary/series?months=N`).
 * `months` vem em ordem ascendente, sempre com N entradas (zero-fill). */
export interface ReceivableSeries {
  months: ReceivableSeriesPoint[];
  yearTotals: {
    year: number;
    received: string; // Decimal do Prisma serializa como string
    expected: string; // Decimal do Prisma serializa como string
  };
}

export interface CreatePlanPayload {
  contractId: string;
  total: number;
  entryAmount: number;
  entryDueDate: string;
  installments: { amount: number; dueDate: string }[];
}

export interface PayReceivablePayload {
  paidAt?: string;
  paidNote?: string;
}

export interface UpdateReceivablePayload {
  amount?: number;
  dueDate?: string;
  description?: string;
}

/** Payload de `POST /receivables/standalone` -- receita sem contrato (ex.: um
 * repasse avulso). `alreadyPaid` marca `paidAt` como `new Date()` no create;
 * não existe undo nesse mesmo request -- editar depois usa pay/unpay normais. */
export interface CreateStandaloneReceivablePayload {
  amount: number;
  description: string;
  dueDate: string;
  alreadyPaid?: boolean;
}

export type ProjectChecklistType = "INSTITUTIONAL" | "SYSTEM";
export type ProjectChecklistPhaseStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE";

export interface ProjectChecklistPhase {
  id: string;
  projectChecklistId: string;
  phaseNumber: number;
  phaseName: string;
  status: ProjectChecklistPhaseStatus;
  naNote: string | null;
  updatedAt: string;
}

export interface ProjectChecklist {
  id: string;
  organizationId: string;
  name: string;
  type: ProjectChecklistType;
  companyId: string | null;
  /** Preenchidos só pela automação pós-fechamento (contrato assinado ->
   *  projeto); nulos nos checklists criados à mão. */
  leadId: string | null;
  contractId: string | null;
  localFolder: string | null;
  startedAt: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Automação pós-fechamento
// ---------------------------------------------------------------------------

export type AutomationExecutionStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";

export type AutomationStepKey = "LEAD_WON" | "RECEIVABLES" | "BRIEFING" | "PROJECT" | "TASKS";

export type AutomationStepStatus =
  "PENDING" | "RUNNING" | "SUCCEEDED" | "SKIPPED" | "NEEDS_ACTION" | "FAILED";

export type AutomationArtifactType =
  "LEAD" | "RECEIVABLE_PLAN" | "BRIEFING" | "PROJECT_CHECKLIST" | "TASK";

export interface AutomationStep {
  id: string;
  executionId: string;
  key: AutomationStepKey;
  status: AutomationStepStatus;
  detail: string | null;
  error: string | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AutomationArtifact {
  id: string;
  executionId: string;
  stepKey: AutomationStepKey;
  key: string;
  type: AutomationArtifactType;
  refId: string;
  label: string | null;
  createdAt: string;
}

export interface AutomationExecution {
  id: string;
  organizationId: string;
  eventType: "CONTRACT_SIGNED";
  contractId: string;
  status: AutomationExecutionStatus;
  triggeredBy: "WEBHOOK" | "MANUAL";
  triggeredById: string | null;
  attempts: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
  steps: AutomationStep[];
  artifacts: AutomationArtifact[];
}

export interface PendingAutomation {
  executionId: string;
  contractId: string;
  contractNumero: string;
  companyName: string | null;
  status: AutomationExecutionStatus;
  finishedAt: string | null;
  /** Só as etapas que exigem ação -- as concluídas não vêm. */
  pendingSteps: { key: AutomationStepKey; status: AutomationStepStatus; detail: string | null }[];
}

export interface PostSaleAutomationSettings {
  id: string;
  organizationId: string;
  enabled: boolean;
  wonStageId: string | null;
  briefingTemplateKey: string | null;
  projectType: ProjectChecklistType | null;
  defaultOwnerId: string | null;
  createReceivables: boolean;
  /** Anuláveis SEM default no banco: decisão financeira do dono. Nulo faz a
   *  etapa de recebimentos virar pendência, nunca um chute. */
  installmentCount: number | null;
  entryDueDays: number | null;
  firstInstallmentDueDays: number | null;
  createBriefing: boolean;
  createProject: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PostSaleSettingsResult {
  settings: PostSaleAutomationSettings;
  /** Rótulos do que ainda falta configurar pra automação rodar inteira. */
  missing: string[];
}

export interface ProjectChecklistSummary extends ProjectChecklist {
  progressPercent: number;
}

export interface ProjectChecklistDetail extends ProjectChecklist {
  phases: ProjectChecklistPhase[];
  progressPercent: number;
}

// ===== Cofre Financeiro =====

/** Resposta da tela bloqueada. Não carrega NADA financeiro de propósito: é
 *  consultada antes do desbloqueio, e um saldo ou uma contagem aqui já seria
 *  vazamento pra quem estiver olhando a tela por cima do ombro. */
export interface VaultStatus {
  enabled: boolean;
  /** ISO. Presente só enquanto o Cofre está temporariamente bloqueado. */
  lockedUntil: string | null;
  attemptsRemaining: number;
}

// ===== Cofre Financeiro — núcleo =====

export type PersonalAccountType = "CHECKING" | "SAVINGS" | "DIGITAL_WALLET" | "CASH";
export type PersonalCurrency = "BRL" | "USD" | "EUR";
export type PersonalDirection = "IN" | "OUT";
export type PersonalTransactionStatus = "PENDING" | "CONFIRMED" | "IGNORED" | "REVERSED";
export type PersonalSplitKind = "PERSONAL" | "REIMBURSABLE" | "BUSINESS";
export type PersonalStatementStatus = "OPEN" | "CLOSED" | "PARTIAL" | "PAID" | "OVERDUE";
export type PersonalDateBasis = "ACCRUAL" | "CASH";

export interface VaultAccount {
  id: string;
  name: string;
  institution: string | null;
  type: PersonalAccountType;
  currency: PersonalCurrency;
  last4: string | null;
  reportedBalance: string | null;
  reportedBalanceAt: string | null;
  isActive: boolean;
}

export interface VaultCard {
  id: string;
  name: string;
  institution: string | null;
  last4: string | null;
  limitAmount: string | null;
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  isActive: boolean;
}

export interface VaultCategory {
  id: string;
  parentId: string | null;
  name: string;
  systemKey: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface VaultCategoryTree extends VaultCategory {
  children: VaultCategory[];
}

export interface VaultMerchantAlias {
  id: string;
  merchantId: string;
  alias: string;
}

export interface VaultMerchant {
  id: string;
  name: string;
  defaultCategoryId: string | null;
  isActive: boolean;
  aliases: VaultMerchantAlias[];
}

export interface VaultSplit {
  id: string;
  transactionId: string;
  kind: PersonalSplitKind;
  amount: string;
  categoryId: string | null;
  note: string | null;
}

export interface VaultTransaction {
  id: string;
  accountId: string | null;
  cardId: string | null;
  transactionDate: string;
  settlementDate: string | null;
  originalDescription: string;
  normalizedDescription: string;
  merchantId: string | null;
  categoryId: string | null;
  subscriptionId: string | null;
  direction: PersonalDirection;
  amount: string;
  currency: PersonalCurrency;
  amountBrl: string;
  status: PersonalTransactionStatus;
  note: string | null;
  statementId: string | null;
  installmentNumber: number | null;
  installmentTotal: number | null;
  isTransfer: boolean;
  /** Dívida que esta movimentação baixa. Quando preenchido, o dinheiro NÃO
   *  entra em receita nem em despesa — ele já foi contado quando a dívida
   *  nasceu. */
  settlesDebtId: string | null;
  splits: VaultSplit[];
  /** Derivados do rateio — não existem no banco. */
  isBusiness: boolean;
  isReimbursable: boolean;
  businessAmount: string;
  reimbursableAmount: string;
  personalConsumption: string;
}

export interface VaultTransactionPage {
  items: VaultTransaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VaultStatement {
  id: string;
  cardId: string;
  referenceMonth: string;
  closingDate: string;
  dueDate: string;
  totalAmount: string;
  paidAmount: string;
  status: PersonalStatementStatus;
}

// ===== Cofre — importação =====

export type VaultImportFormat = "OFX" | "CSV";
export type VaultImportRowStatus = "NEW" | "DUPLICATE_FILE" | "DUPLICATE_VAULT" | "INVALID";

export interface VaultImportPreviewRow {
  line: number;
  date: string | null;
  description: string;
  amount: string | null;
  direction: PersonalDirection | null;
  externalId: string | null;
  status: VaultImportRowStatus;
  errors: string[];
}

export interface VaultImportPreview {
  format: VaultImportFormat;
  fileHash: string;
  fileName: string;
  needsMapping: boolean;
  headers: string[];
  delimiter: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  summary: { total: number; novas: number; duplicadas: number; invalidas: number };
  alreadyImported: boolean;
  rows: VaultImportPreviewRow[];
}

export interface VaultImportBatch {
  id: string;
  accountId: string | null;
  cardId: string | null;
  format: VaultImportFormat;
  fileName: string;
  periodStart: string | null;
  periodEnd: string | null;
  totalRows: number;
  importedRows: number;
  duplicateRows: number;
  ignoredRows: number;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  errors: Array<{ line: number; code: string }>;
  createdAt: string;
}

export interface VaultColumnMap {
  date: string | number;
  description: string | number;
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  externalId?: string | number;
}

export interface VaultImportSettings {
  delimiter: string;
  decimalSeparator: string;
  dateOrder: "DMY" | "MDY" | "YMD";
  hasHeader: boolean;
  invertSign: boolean;
  columnMap: VaultColumnMap;
}

export interface VaultImportProfile extends VaultImportSettings {
  id: string;
  name: string;
  accountId: string | null;
  cardId: string | null;
  format: VaultImportFormat;
}

// ===== Cofre — classificação =====

export type VaultRuleMatchType = "CONTAINS" | "STARTS_WITH" | "EXACT";

export interface VaultRule {
  id: string;
  name: string | null;
  priority: number;
  isActive: boolean;
  matchType: VaultRuleMatchType | null;
  matchValue: string | null;
  matchMerchantId: string | null;
  matchAccountId: string | null;
  matchCardId: string | null;
  matchAmountMinCents: number | null;
  matchAmountMaxCents: number | null;
  setMerchantId: string | null;
  setCategoryId: string | null;
  setSubscriptionId: string | null;
  businessPercent: string | null;
}

export interface VaultClassificationRun {
  processadas: number;
  classificadas: number;
  pendentes: number;
}

// ===== Cofre — assinaturas e alertas =====

export type VaultSubscriptionPeriod = "MONTHLY" | "YEARLY" | "CUSTOM";
export type VaultSubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELED";
export type VaultAlertType =
  | "RENEWS_TODAY"
  | "RENEWS_TOMORROW"
  | "RENEWS_IN_3_DAYS"
  | "RENEWS_IN_7_DAYS"
  | "PRICE_CHANGED"
  | "POSSIBLE_DUPLICATE"
  | "MISSING_CHARGE"
  | "POSSIBLE_NEW_SUBSCRIPTION";

export interface VaultSubscription {
  id: string;
  name: string;
  merchantId: string | null;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  expectedCents: number;
  currency: PersonalCurrency;
  period: VaultSubscriptionPeriod;
  customIntervalDays: number | null;
  lastChargeAt: string | null;
  nextRenewalAt: string | null;
  alertDaysBefore: number;
  priceTolerancePct: number;
  status: VaultSubscriptionStatus;
  autoRenew: boolean;
  costSubscriptionId: string | null;
  notes: string | null;
}

export interface VaultAlert {
  id: string;
  subscriptionId: string | null;
  transactionId: string | null;
  type: VaultAlertType;
  referenceDate: string;
  status: "PENDING" | "READ" | "SNOOZED";
  snoozedUntil: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface VaultAlertRefresh {
  novosAlertas: number;
  cobrancasVinculadas: number;
  pendentes: VaultAlert[];
}

// ----- Cofre: pessoas e dívidas -----

export type VaultDebtDirection = "THEY_OWE_ME" | "I_OWE_THEM";
export type VaultDebtStatus = "OPEN" | "PARTIAL" | "PAID" | "OVERDUE" | "CANCELED";

export interface VaultContact {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface VaultDebtPayment {
  id: string;
  amount: string;
  paidAt: string;
  transactionId: string | null;
  note: string | null;
}

export interface VaultDebt {
  id: string;
  contactId: string;
  contactName: string;
  direction: VaultDebtDirection;
  description: string;
  originalAmount: string;
  /** Derivados das baixas e da data de hoje — nenhum é coluna no banco. */
  paidAmount: string;
  balance: string;
  overpaid: string;
  status: VaultDebtStatus;
  currency: PersonalCurrency;
  dueDate: string | null;
  originTransactionId: string | null;
  canceledAt: string | null;
  notes: string | null;
  payments: VaultDebtPayment[];
  createdAt: string;
}

export interface VaultDebtSummary {
  aReceber: string;
  aPagar: string;
  atrasadasReceber: number;
  atrasadasPagar: number;
}

// ----- Ponte Cofre <-> financeiro da MilWeb -----

export type BridgeState = "NAO_ENVIADA" | "ENVIADA" | "DESATUALIZADA";
export type BusinessExpenseSource = "MANUAL" | "PERSONAL_VAULT";

/** Uma compra pessoal com parte empresarial, e o estado dela na ponte. */
export interface VaultBridgeItem {
  transactionId: string;
  transactionDate: string;
  /** A linha do extrato. Visível só dentro do Cofre — não é o que vai pro
   *  financeiro; lá vai a descrição que a pessoa escreve. */
  originalDescription: string;
  amountBrl: string;
  businessAmount: string;
  state: BridgeState;
  expenseId: string | null;
  sentAmount: string | null;
  sentDescription: string | null;
  organizationId: string | null;
}

export interface CostPlanOption {
  id: string;
  name: string;
  amount: string;
  currency: "BRL" | "USD";
  billingCycle: "MONTHLY" | "YEARLY";
}

export interface BusinessExpense {
  id: string;
  description: string;
  amount: string;
  currency: "BRL" | "USD";
  incurredAt: string;
  category: CostCategory;
  costSubscriptionId: string | null;
  companyId: string | null;
  source: BusinessExpenseSource;
  notes: string | null;
}

export interface ExpensePlanComparison {
  costSubscriptionId: string;
  name: string;
  planejadoBrl: number;
  realizadoBrl: number;
  /** `realizado − planejado`. Nunca a soma dos dois — ver expense-summary.ts. */
  diferencaBrl: number;
  lancamentos: number;
}

export interface BusinessExpenseSummary {
  realizadoBrl: number;
  planejadoBrl: number;
  /** Quanto do realizado saiu do bolso do dono — é o que a empresa deve a ele. */
  doCofreBrl: number;
  porPlano: ExpensePlanComparison[];
  semPlano: { realizadoBrl: number; lancamentos: number };
}

// ----- Resumo mensal do Cofre -----

export interface VaultCategoryLine {
  categoryId: string | null;
  total: string;
  lancamentos: number;
}

export interface VaultMonthSummary {
  entradas: string;
  saidas: string;
  /** `entradas − saídas`. Pode ser negativo. */
  resultado: string;
  /** Quanto das saídas foi gasto com você — diferente de "quanto saiu". */
  consumoPessoal: string;
  daEmpresa: string;
  reembolsavel: string;
  /** O que se moveu sem ser receita nem despesa, para o dinheiro não sumir da
   *  tela: transferências e baixas de dívida. */
  foraDoFluxo: {
    transferencias: { total: string; lancamentos: number };
    baixasDivida: { total: string; lancamentos: number };
  };
  porCategoria: VaultCategoryLine[];
  lancamentos: number;
}

// ----- Análise de extrato -----

export type ImportConfidence = "alta" | "media" | "baixa";
export type ImportMatchLevel = "exata" | "provavel" | "ambigua" | "nenhuma";
export type ImportTransactionKind =
  | "COMPRA"
  | "TRANSFERENCIA"
  | "PAGAMENTO_FATURA"
  | "ESTORNO"
  | "SAQUE"
  | "DEPOSITO"
  | "TARIFA"
  | "JUROS"
  | "BOLETO";

/** O que o próprio arquivo declara sobre si. Nada aqui é inferido. */
export interface VaultImportIdentity {
  kind: "account" | "card" | null;
  institution: string | null;
  bankId: string | null;
  fid: string | null;
  accountNumber: string | null;
  last4: string | null;
  accountType: string | null;
  currency: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  balance: string | null;
  balanceAt: string | null;
}

export interface VaultImportCandidate {
  id: string;
  name: string;
  institution: string | null;
  last4: string | null;
}

export interface VaultImportMatch {
  level: ImportMatchLevel;
  kind: "account" | "card" | null;
  /** Preenchido só quando a evidência é única — ver import-origin-match. */
  selectedId: string | null;
  candidates: VaultImportCandidate[];
  reason: string;
}

export interface VaultImportSuggestion {
  kind: "account" | "card";
  name: string;
  institution: string | null;
  last4: string | null;
  accountType: string | null;
  currency: string | null;
}

export interface VaultAnalyzedRow extends VaultImportPreviewRow {
  displayName: string;
  merchantHint: string | null;
  personHint: string | null;
  categoryHint: string | null;
  subcategoryHint: string | null;
  businessHint: boolean;
  kind: ImportTransactionKind;
  /** Fora de receita e despesa: transferência própria, fatura, estorno. */
  neutral: boolean;
  installmentNumber: number | null;
  installmentTotal: number | null;
  confidence: ImportConfidence;
}

export interface VaultImportTotals {
  linhas: number;
  entradas: string;
  saidas: string;
  novas: number;
  duplicadas: number;
  jaImportadas: number;
  revisar: number;
  invalidas: number;
  milweb: number;
  neutras: number;
}

export interface VaultImportAnalysis {
  format: VaultImportFormat;
  fileHash: string;
  fileName: string;
  identity: VaultImportIdentity;
  match: VaultImportMatch;
  suggestion: VaultImportSuggestion | null;
  detection: {
    confidence: ImportConfidence;
    pendencias: string[];
    ignoradas: string[];
    settings: VaultImportSettings;
  } | null;
  headers: string[];
  delimiter: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  totals: VaultImportTotals;
  alreadyImported: boolean;
  rows: VaultAnalyzedRow[];
}
