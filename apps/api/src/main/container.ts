import { ActivityLogger } from "../application/services/activity-logger.js";
import { AiService } from "../application/services/ai-service.js";
import { AuditLogger } from "../application/services/audit-logger.js";
import { AuditService } from "../application/services/audit-service.js";
import { BriefingAnswerService } from "../application/services/briefing-answer-service.js";
import { BriefingCompletionService } from "../application/services/briefing-completion-service.js";
import { BriefingFileService } from "../application/services/briefing-file-service.js";
import { BriefingService } from "../application/services/briefing-service.js";
import { ContractService } from "../application/services/contract-service.js";
import { CostService } from "../application/services/cost-service.js";
import { EstimateService } from "../application/services/estimate-service.js";
import { MessageService } from "../application/services/message-service.js";
import { PostSaleSettingsService } from "../application/services/post-sale-settings-service.js";
import { ProjectChecklistService } from "../application/services/project-checklist-service.js";
import { PersonalAccountService } from "../application/services/personal-account-service.js";
import { PersonalCatalogService } from "../application/services/personal-catalog-service.js";
import { PersonalClassificationService } from "../application/services/personal-classification-service.js";
import { PersonalDebtService } from "../application/services/personal-debt-service.js";
import { PersonalSubscriptionService } from "../application/services/personal-subscription-service.js";
import { PersonalImportService } from "../application/services/personal-import-service.js";
import { PersonalTransactionService } from "../application/services/personal-transaction-service.js";
import { PersonalVaultService } from "../application/services/personal-vault-service.js";
import { ReceivableService } from "../application/services/receivable-service.js";
import { CompanyService } from "../application/services/company-service.js";
import { LeadService } from "../application/services/lead-service.js";
import { MeetingService } from "../application/services/meeting-service.js";
import { PipelineService } from "../application/services/pipeline-service.js";
import { ProposalPublicService } from "../application/services/proposal-public-service.js";
import { ProposalService } from "../application/services/proposal-service.js";
import { SettingsService } from "../application/services/settings-service.js";
import { SocialService } from "../application/services/social-service.js";
import { DefaultProposalNotifier } from "../infrastructure/proposals/proposal-notifier.js";
import { SessionIssuer } from "../application/services/session-issuer.js";
import { TagService } from "../application/services/tag-service.js";
import { TaskService } from "../application/services/task-service.js";
import { TeamService } from "../application/services/team-service.js";
import { ChangePasswordUseCase } from "../application/use-cases/auth/change-password-use-case.js";
import { GetCurrentUserUseCase } from "../application/use-cases/auth/get-current-user-use-case.js";
import { LoginUseCase } from "../application/use-cases/auth/login-use-case.js";
import { LogoutUseCase } from "../application/use-cases/auth/logout-use-case.js";
import { RefreshUseCase } from "../application/use-cases/auth/refresh-use-case.js";
import { RegisterUseCase } from "../application/use-cases/auth/register-use-case.js";
import { PERMISSIONS } from "@millead/database/permissions";
import { env } from "../config/env.js";
import { BcryptPasswordHasher } from "../infrastructure/auth/bcrypt-password-hasher.js";
import { JwtAccessTokenService } from "../infrastructure/auth/jwt-access-token-service.js";
import { JwtVaultSessionService } from "../infrastructure/auth/jwt-vault-session-service.js";
import { ClaudeCreativeDirector } from "../infrastructure/ai/claude-creative-director.js";
import { ClaudeLeadAi } from "../infrastructure/ai/claude-lead-ai.js";
import { ClaudeSocialAnalyst } from "../infrastructure/ai/claude-social-analyst.js";
import { GraphApiInstagramClient } from "../infrastructure/instagram/graph-api-client.js";
import { WebPushSender } from "../infrastructure/push/web-push-sender.js";
import { VercelBlobStorage } from "../infrastructure/blob/vercel-blob-storage.js";
import { DefaultBriefingNotifier } from "../infrastructure/briefings/notifications/briefing-notifier.js";
import { DefaultContractNotifier } from "../infrastructure/contracts/notifications/contract-notifier.js";
import { createSignatureGateway } from "../infrastructure/contracts/signature/factory.js";
import { PgBossAuditQueue } from "../infrastructure/queue/pg-audit-queue.js";
import { PgBossBriefingQueue } from "../infrastructure/queue/pg-briefing-queue.js";
import { PgBossContractQueue } from "../infrastructure/queue/pg-contract-queue.js";
import { PrismaActivityRepository } from "../infrastructure/prisma/prisma-activity-repository.js";
import { PrismaAuditLogRepository } from "../infrastructure/prisma/prisma-audit-log-repository.js";
import { PrismaAuditRepository } from "../infrastructure/prisma/prisma-audit-repository.js";
import { CachedBriefingTemplateRepository } from "../infrastructure/prisma/cached-briefing-template-repository.js";
import { PrismaBriefingAnswerRepository } from "../infrastructure/prisma/prisma-briefing-answer-repository.js";
import { PrismaBriefingFileRepository } from "../infrastructure/prisma/prisma-briefing-file-repository.js";
import { PrismaBriefingRepository } from "../infrastructure/prisma/prisma-briefing-repository.js";
import { PrismaBriefingTemplateRepository } from "../infrastructure/prisma/prisma-briefing-template-repository.js";
import { PrismaCompanyRepository } from "../infrastructure/prisma/prisma-company-repository.js";
import { PrismaLeadRepository } from "../infrastructure/prisma/prisma-lead-repository.js";
import { PrismaContractRepository } from "../infrastructure/prisma/prisma-contract-repository.js";
import { PrismaCostRepository } from "../infrastructure/prisma/prisma-cost-repository.js";
import { PrismaEstimateRepository } from "../infrastructure/prisma/prisma-estimate-repository.js";
import { PrismaReceivableRepository } from "../infrastructure/prisma/prisma-receivable-repository.js";
import { PrismaMeetingRepository } from "../infrastructure/prisma/prisma-meeting-repository.js";
import { PrismaMessageRepository } from "../infrastructure/prisma/prisma-message-repository.js";
import { PrismaMessageTemplateRepository } from "../infrastructure/prisma/prisma-message-template-repository.js";
import { PrismaMembershipRepository } from "../infrastructure/prisma/prisma-membership-repository.js";
import { PrismaOrganizationRepository } from "../infrastructure/prisma/prisma-organization-repository.js";
import { PrismaPipelineRepository } from "../infrastructure/prisma/prisma-pipeline-repository.js";
import { PrismaPostSaleAutomationRepository } from "../infrastructure/prisma/prisma-post-sale-automation-repository.js";
import { PrismaProjectChecklistRepository } from "../infrastructure/prisma/prisma-project-checklist-repository.js";
import { PrismaProposalRepository } from "../infrastructure/prisma/prisma-proposal-repository.js";
import { PrismaRefreshTokenRepository } from "../infrastructure/prisma/prisma-refresh-token-repository.js";
import { PrismaRoleRepository } from "../infrastructure/prisma/prisma-role-repository.js";
import { PrismaSocialRepository } from "../infrastructure/prisma/prisma-social-repository.js";
import { PrismaTagRepository } from "../infrastructure/prisma/prisma-tag-repository.js";
import { PrismaTaskRepository } from "../infrastructure/prisma/prisma-task-repository.js";
import { buildPostSaleOnboardingService } from "./post-sale-factory.js";
import { PrismaPersonalAccountRepository } from "../infrastructure/prisma/prisma-personal-account-repository.js";
import { PrismaPersonalCatalogRepository } from "../infrastructure/prisma/prisma-personal-catalog-repository.js";
import { PrismaPersonalDebtRepository } from "../infrastructure/prisma/prisma-personal-debt-repository.js";
import { PrismaPersonalImportRepository } from "../infrastructure/prisma/prisma-personal-import-repository.js";
import { PrismaPersonalRuleRepository } from "../infrastructure/prisma/prisma-personal-rule-repository.js";
import { PrismaPersonalSubscriptionRepository } from "../infrastructure/prisma/prisma-personal-subscription-repository.js";
import { PrismaPersonalStatementRepository } from "../infrastructure/prisma/prisma-personal-statement-repository.js";
import { PrismaPersonalTransactionRepository } from "../infrastructure/prisma/prisma-personal-transaction-repository.js";
import { PrismaPersonalVaultRepository } from "../infrastructure/prisma/prisma-personal-vault-repository.js";
import { PrismaUserRepository } from "../infrastructure/prisma/prisma-user-repository.js";
import { PrismaTeamRepository } from "../infrastructure/prisma/prisma-team-repository.js";
import { DefaultTeamInvitationNotifier } from "../infrastructure/team/default-team-invitation-notifier.js";
import { apiKeyOrSession } from "../interfaces/http/middlewares/api-key-or-session.js";
import { createAuthenticateMiddleware } from "../interfaces/http/middlewares/authenticate.js";
import { createRequireOwner } from "../interfaces/http/middlewares/require-owner.js";
import { createRequireVault } from "../interfaces/http/middlewares/require-vault.js";
import { AiController } from "../interfaces/http/controllers/ai-controller.js";
import { AuditController } from "../interfaces/http/controllers/audit-controller.js";
import { AuthController } from "../interfaces/http/controllers/auth-controller.js";
import { BriefingController } from "../interfaces/http/controllers/briefing-controller.js";
import { ContractController } from "../interfaces/http/controllers/contract-controller.js";
import { CostController } from "../interfaces/http/controllers/cost-controller.js";
import { EstimateController } from "../interfaces/http/controllers/estimate-controller.js";
import { MessageController } from "../interfaces/http/controllers/message-controller.js";
import { PersonalFinanceController } from "../interfaces/http/controllers/personal-finance-controller.js";
import { PersonalVaultController } from "../interfaces/http/controllers/personal-vault-controller.js";
import { ReceivableController } from "../interfaces/http/controllers/receivable-controller.js";
import { CompanyController } from "../interfaces/http/controllers/company-controller.js";
import { LeadController } from "../interfaces/http/controllers/lead-controller.js";
import { MeetingController } from "../interfaces/http/controllers/meeting-controller.js";
import { PipelineController } from "../interfaces/http/controllers/pipeline-controller.js";
import { PostSaleController } from "../interfaces/http/controllers/post-sale-controller.js";
import { ProjectChecklistController } from "../interfaces/http/controllers/project-checklist-controller.js";
import { ProposalController } from "../interfaces/http/controllers/proposal-controller.js";
import { SettingsController } from "../interfaces/http/controllers/settings-controller.js";
import { SocialController } from "../interfaces/http/controllers/social-controller.js";
import { TagController } from "../interfaces/http/controllers/tag-controller.js";
import { TaskController } from "../interfaces/http/controllers/task-controller.js";
import { TeamController } from "../interfaces/http/controllers/team-controller.js";
import type { MembershipRepository } from "../domain/repositories/membership-repository.js";
import type { RequestHandler } from "express";

export interface Container {
  aiController: AiController;
  auditController: AuditController;
  authController: AuthController;
  briefingController: BriefingController;
  companyController: CompanyController;
  contractController: ContractController;
  costController: CostController;
  estimateController: EstimateController;
  messageController: MessageController;
  leadController: LeadController;
  meetingController: MeetingController;
  pipelineController: PipelineController;
  postSaleController: PostSaleController;
  projectChecklistController: ProjectChecklistController;
  projectChecklistAuthenticate: RequestHandler;
  proposalController: ProposalController;
  receivableController: ReceivableController;
  settingsController: SettingsController;
  socialController: SocialController;
  tagController: TagController;
  taskController: TaskController;
  teamController: TeamController;
  authenticate: RequestHandler;
  requireOwner: RequestHandler;
  personalVaultController: PersonalVaultController;
  personalFinanceController: PersonalFinanceController;
  /** Exposto pro job de alertas (fase 5) e pro proximo passo. */
  personalSubscriptionService: PersonalSubscriptionService;
  /** Exposto pro próximo passo: as rotas de dados do Cofre (fases seguintes)
   *  montam sob este middleware, nunca sob `requirePermission`. */
  requireVault: RequestHandler;
  personalVaultService: PersonalVaultService;
  membershipRepository: MembershipRepository;
  auditLogger: AuditLogger;
}

/**
 * Composition root -- único lugar do projeto onde interfaces de domínio são
 * ligadas às implementações concretas de infraestrutura. Nenhuma outra
 * camada deve importar diretamente de `infrastructure/prisma` etc.
 *
 * DI manual (sem framework): nessa escala, um objeto simples é mais fácil
 * de seguir do que introduzir InversifyJS/tsyringe. Reavaliar se o número
 * de dependências crescer muito.
 */
export function buildContainer(): Container {
  // ---- Repositórios ----
  const userRepository = new PrismaUserRepository();
  const organizationRepository = new PrismaOrganizationRepository();
  const roleRepository = new PrismaRoleRepository();
  const membershipRepository = new PrismaMembershipRepository();
  const teamRepository = new PrismaTeamRepository();
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const auditLogRepository = new PrismaAuditLogRepository();
  const companyRepository = new PrismaCompanyRepository();
  const activityRepository = new PrismaActivityRepository();
  const pipelineRepository = new PrismaPipelineRepository();
  const projectChecklistRepository = new PrismaProjectChecklistRepository();
  const postSaleAutomationRepository = new PrismaPostSaleAutomationRepository();
  const tagRepository = new PrismaTagRepository();
  const leadRepository = new PrismaLeadRepository();
  const taskRepository = new PrismaTaskRepository();
  const meetingRepository = new PrismaMeetingRepository();
  const proposalRepository = new PrismaProposalRepository();
  const auditRepository = new PrismaAuditRepository();
  const messageRepository = new PrismaMessageRepository();
  const messageTemplateRepository = new PrismaMessageTemplateRepository();
  const contractRepository = new PrismaContractRepository();
  const costRepository = new PrismaCostRepository();
  const estimateRepository = new PrismaEstimateRepository();
  const receivableRepository = new PrismaReceivableRepository();
  // Cacheado em memória (5min): estrutura de template (seções/campos) só
  // muda por seed manual, que reinicia o processo e já limpa o cache.
  const briefingTemplateRepository = new CachedBriefingTemplateRepository(
    new PrismaBriefingTemplateRepository(),
  );
  const briefingRepository = new PrismaBriefingRepository(briefingTemplateRepository);
  const briefingAnswerRepository = new PrismaBriefingAnswerRepository();
  const briefingFileRepository = new PrismaBriefingFileRepository();
  const socialRepository = new PrismaSocialRepository();

  // ---- Serviços ----
  const passwordHasher = new BcryptPasswordHasher();
  const accessTokenService = new JwtAccessTokenService();
  const vaultSessionService = new JwtVaultSessionService();
  const personalVaultRepository = new PrismaPersonalVaultRepository();
  const personalAccountRepository = new PrismaPersonalAccountRepository();
  const personalCatalogRepository = new PrismaPersonalCatalogRepository();
  const personalTransactionRepository = new PrismaPersonalTransactionRepository();
  const personalStatementRepository = new PrismaPersonalStatementRepository();
  const personalImportRepository = new PrismaPersonalImportRepository();
  const personalRuleRepository = new PrismaPersonalRuleRepository();
  const personalSubscriptionRepository = new PrismaPersonalSubscriptionRepository();
  const personalDebtRepository = new PrismaPersonalDebtRepository();
  // Instancia propria do push: os alertas do Cofre usam `sendToUser`, nunca
  // `sendToOrg` -- ver o comentario na porta PushSender.
  const vaultPushSender = new WebPushSender();
  const auditLogger = new AuditLogger(auditLogRepository);

  // Cofre Financeiro. Criado aqui, antes dos use-cases de auth, porque
  // logout e troca de senha dependem dele (pela porta VaultLocker) pra
  // fechar as sessões elevadas. Note que NÃO passa por `requirePermission`
  // em lugar nenhum -- ver o comentário em routes/vault-routes.ts.
  const personalCatalogService = new PersonalCatalogService(personalCatalogRepository);
  const personalAccountService = new PersonalAccountService(personalAccountRepository);
  // Antes do serviço de movimentações: ele recebe a porta `DebtLinkChecker`
  // pra recusar, com 409, apagar uma movimentação que baixa dívida. Sem ciclo
  // — o serviço de dívidas depende do REPOSITÓRIO de movimentações, não do
  // serviço.
  const personalDebtService = new PersonalDebtService(
    personalDebtRepository,
    personalTransactionRepository,
  );
  const personalTransactionService = new PersonalTransactionService(
    personalTransactionRepository,
    personalAccountRepository,
    personalStatementRepository,
    personalDebtService,
  );
  // A classificacao e criada antes da importacao: a importacao dispara uma
  // passada de classificacao no que acabou de gravar, pela porta estreita
  // TransactionClassifier.
  const personalClassificationService = new PersonalClassificationService(
    personalRuleRepository,
    personalCatalogRepository,
    personalTransactionRepository,
    personalSubscriptionRepository,
  );
  const personalSubscriptionService = new PersonalSubscriptionService(
    personalSubscriptionRepository,
    personalCatalogRepository,
    vaultPushSender,
  );
  const personalImportService = new PersonalImportService(
    personalImportRepository,
    personalTransactionRepository,
    personalAccountRepository,
    personalStatementRepository,
    personalClassificationService,
  );
  const personalVaultService = new PersonalVaultService(
    personalVaultRepository,
    userRepository,
    passwordHasher,
    vaultSessionService,
    auditLogger,
    // Provisiona a árvore de categorias na criação do Cofre, pela porta
    // estreita VaultProvisioner.
    personalCatalogService,
  );
  const activityLogger = new ActivityLogger(activityRepository);
  const sessionIssuer = new SessionIssuer(accessTokenService, refreshTokenRepository);
  const companyService = new CompanyService(companyRepository);
  const leadService = new LeadService(
    leadRepository,
    pipelineRepository,
    activityLogger,
    membershipRepository,
  );
  const pipelineService = new PipelineService(pipelineRepository);
  const projectChecklistService = new ProjectChecklistService(
    projectChecklistRepository,
    companyRepository,
    leadRepository,
    contractRepository,
  );
  const tagService = new TagService(tagRepository);
  const taskService = new TaskService(taskRepository, membershipRepository);
  const teamService = new TeamService(
    teamRepository,
    roleRepository,
    userRepository,
    passwordHasher,
    sessionIssuer,
    auditLogger,
    new DefaultTeamInvitationNotifier(),
  );
  const meetingService = new MeetingService(meetingRepository);
  const proposalNotifier = new DefaultProposalNotifier();
  const proposalService = new ProposalService(
    proposalRepository,
    activityLogger,
    leadRepository,
    organizationRepository,
    proposalNotifier,
    contractRepository,
  );
  const settingsService = new SettingsService(userRepository, organizationRepository);
  const auditService = new AuditService(auditRepository, companyRepository, new PgBossAuditQueue());
  const messageService = new MessageService(
    messageRepository,
    messageTemplateRepository,
    activityLogger,
  );
  // IA é opcional: sem chave, o service existe mas recusa com 503 amigável.
  const leadAi = env.ANTHROPIC_API_KEY
    ? new ClaudeLeadAi(env.ANTHROPIC_API_KEY, env.AI_MODEL)
    : null;
  const creativeDirector = env.ANTHROPIC_API_KEY
    ? new ClaudeCreativeDirector(env.ANTHROPIC_API_KEY, env.AI_MODEL)
    : null;
  // A automação pós-fechamento é montada pela fábrica compartilhada com o
  // worker (main/post-sale-factory.ts) -- um grafo só, dois processos.
  const postSaleOnboardingService = buildPostSaleOnboardingService();
  const contractService = new ContractService(
    contractRepository,
    companyRepository,
    organizationRepository,
    new PgBossContractQueue(),
    createSignatureGateway(),
    new DefaultContractNotifier(),
    postSaleOnboardingService,
  );
  const postSaleSettingsService = new PostSaleSettingsService(
    postSaleAutomationRepository,
    pipelineRepository,
    briefingTemplateRepository,
    membershipRepository,
  );
  const proposalPublicService = new ProposalPublicService(
    proposalRepository,
    estimateRepository,
    leadRepository,
    companyRepository,
    organizationRepository,
    contractService,
    proposalNotifier,
    new WebPushSender(),
    activityLogger,
  );
  const costService = new CostService(costRepository, companyRepository);
  const blobStorage = new VercelBlobStorage();
  const estimateService = new EstimateService(
    estimateRepository,
    costService,
    leadRepository,
    companyRepository,
    organizationRepository,
    proposalRepository,
    blobStorage,
    activityLogger,
  );
  const receivableService = new ReceivableService(
    receivableRepository,
    contractRepository,
    estimateService,
  );
  const briefingService = new BriefingService(
    briefingRepository,
    briefingTemplateRepository,
    new DefaultBriefingNotifier(),
    activityLogger,
    companyRepository,
    leadRepository,
  );
  const briefingAnswerService = new BriefingAnswerService(
    briefingRepository,
    briefingAnswerRepository,
  );
  const briefingCompletionService = new BriefingCompletionService(
    briefingRepository,
    briefingAnswerRepository,
    new PgBossBriefingQueue(),
    activityLogger,
    new WebPushSender(),
  );
  const briefingFileService = new BriefingFileService(
    briefingRepository,
    briefingFileRepository,
    blobStorage,
  );
  const aiService = new AiService(
    leadAi,
    leadRepository,
    companyRepository,
    auditRepository,
    pipelineRepository,
    organizationRepository,
    messageTemplateRepository,
    messageRepository,
    activityLogger,
    creativeDirector,
  );
  const socialAnalyst = env.ANTHROPIC_API_KEY
    ? new ClaudeSocialAnalyst(env.ANTHROPIC_API_KEY, env.AI_MODEL)
    : null;
  const socialService = new SocialService(
    socialRepository,
    new GraphApiInstagramClient(),
    socialAnalyst,
    env.INSTAGRAM_ACCESS_TOKEN,
  );

  // ---- Use-cases ----
  const registerUseCase = new RegisterUseCase(
    userRepository,
    organizationRepository,
    roleRepository,
    membershipRepository,
    passwordHasher,
    sessionIssuer,
    auditLogger,
  );
  const loginUseCase = new LoginUseCase(
    userRepository,
    membershipRepository,
    passwordHasher,
    sessionIssuer,
    auditLogger,
  );
  const refreshUseCase = new RefreshUseCase(
    refreshTokenRepository,
    userRepository,
    membershipRepository,
    sessionIssuer,
    auditLogger,
  );
  const logoutUseCase = new LogoutUseCase(
    refreshTokenRepository,
    auditLogger,
    personalVaultService,
  );
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository, membershipRepository);
  const changePasswordUseCase = new ChangePasswordUseCase(
    userRepository,
    passwordHasher,
    refreshTokenRepository,
    auditLogger,
    personalVaultService,
  );

  // ---- Controllers & middlewares ----
  const authController = new AuthController(
    registerUseCase,
    loginUseCase,
    refreshUseCase,
    logoutUseCase,
    getCurrentUserUseCase,
    changePasswordUseCase,
  );
  const companyController = new CompanyController(companyService);
  const leadController = new LeadController(leadService);
  const pipelineController = new PipelineController(pipelineService);
  const tagController = new TagController(tagService);
  const taskController = new TaskController(taskService);
  const teamController = new TeamController(teamService);
  const meetingController = new MeetingController(meetingService);
  const proposalController = new ProposalController(proposalService, proposalPublicService);
  const settingsController = new SettingsController(settingsService);
  const auditController = new AuditController(auditService);
  const aiController = new AiController(aiService);
  const messageController = new MessageController(messageService);
  const contractController = new ContractController(contractService);
  const costController = new CostController(costService);
  const estimateController = new EstimateController(estimateService);
  const receivableController = new ReceivableController(receivableService);
  const briefingController = new BriefingController(
    briefingService,
    briefingAnswerService,
    briefingCompletionService,
    briefingFileService,
  );
  const socialController = new SocialController(socialService);
  const authenticate = createAuthenticateMiddleware(accessTokenService, membershipRepository);
  const projectChecklistController = new ProjectChecklistController(projectChecklistService);
  const postSaleController = new PostSaleController(
    postSaleSettingsService,
    postSaleOnboardingService,
  );
  const projectChecklistAuthenticate = apiKeyOrSession(
    env.AUTOMATION_API_KEY,
    env.AUTOMATION_ORGANIZATION_ID,
    [PERMISSIONS.PROJECT_CHECKLISTS_READ, PERMISSIONS.PROJECT_CHECKLISTS_WRITE],
    authenticate,
  );
  const requireOwner = createRequireOwner(userRepository, env.OWNER_EMAIL);

  const personalVaultController = new PersonalVaultController(personalVaultService);
  const personalFinanceController = new PersonalFinanceController(
    personalAccountService,
    personalCatalogService,
    personalTransactionService,
    personalImportService,
    personalClassificationService,
    personalSubscriptionService,
    personalDebtService,
  );
  const requireVault = createRequireVault(personalVaultRepository, vaultSessionService);

  return {
    aiController,
    auditController,
    authController,
    briefingController,
    contractController,
    costController,
    estimateController,
    messageController,
    companyController,
    leadController,
    meetingController,
    pipelineController,
    postSaleController,
    projectChecklistController,
    projectChecklistAuthenticate,
    proposalController,
    receivableController,
    settingsController,
    socialController,
    tagController,
    taskController,
    teamController,
    authenticate,
    requireOwner,
    personalVaultController,
    personalFinanceController,
    personalVaultService,
    personalSubscriptionService,
    requireVault,
    membershipRepository,
    auditLogger,
  };
}
