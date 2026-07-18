import { ActivityLogger } from "../application/services/activity-logger.js";
import { AiService } from "../application/services/ai-service.js";
import { AuditLogger } from "../application/services/audit-logger.js";
import { AuditService } from "../application/services/audit-service.js";
import { BriefingAnswerService } from "../application/services/briefing-answer-service.js";
import { BriefingCompletionService } from "../application/services/briefing-completion-service.js";
import { BriefingFileService } from "../application/services/briefing-file-service.js";
import { BriefingService } from "../application/services/briefing-service.js";
import { ContractService } from "../application/services/contract-service.js";
import { LandingPageService } from "../application/services/landing-page-service.js";
import { MessageService } from "../application/services/message-service.js";
import { CompanyService } from "../application/services/company-service.js";
import { LeadService } from "../application/services/lead-service.js";
import { MeetingService } from "../application/services/meeting-service.js";
import { PipelineService } from "../application/services/pipeline-service.js";
import { ProposalService } from "../application/services/proposal-service.js";
import { SettingsService } from "../application/services/settings-service.js";
import { DefaultProposalNotifier } from "../infrastructure/proposals/proposal-notifier.js";
import { SessionIssuer } from "../application/services/session-issuer.js";
import { TagService } from "../application/services/tag-service.js";
import { TaskService } from "../application/services/task-service.js";
import { GetCurrentUserUseCase } from "../application/use-cases/auth/get-current-user-use-case.js";
import { LoginUseCase } from "../application/use-cases/auth/login-use-case.js";
import { LogoutUseCase } from "../application/use-cases/auth/logout-use-case.js";
import { RefreshUseCase } from "../application/use-cases/auth/refresh-use-case.js";
import { RegisterUseCase } from "../application/use-cases/auth/register-use-case.js";
import { env } from "../config/env.js";
import { BcryptPasswordHasher } from "../infrastructure/auth/bcrypt-password-hasher.js";
import { JwtAccessTokenService } from "../infrastructure/auth/jwt-access-token-service.js";
import { ClaudeLeadAi } from "../infrastructure/ai/claude-lead-ai.js";
import { VercelBlobStorage } from "../infrastructure/blob/vercel-blob-storage.js";
import { DefaultBriefingNotifier } from "../infrastructure/briefings/notifications/briefing-notifier.js";
import { DefaultContractNotifier } from "../infrastructure/contracts/notifications/contract-notifier.js";
import { createSignatureGateway } from "../infrastructure/contracts/signature/factory.js";
import { BullAuditQueue } from "../infrastructure/queue/bull-audit-queue.js";
import { BullBriefingQueue } from "../infrastructure/queue/bull-briefing-queue.js";
import { BullContractQueue } from "../infrastructure/queue/bull-contract-queue.js";
import { BullLandingPageQueue } from "../infrastructure/queue/bull-landing-page-queue.js";
import { PrismaActivityRepository } from "../infrastructure/prisma/prisma-activity-repository.js";
import { PrismaAuditLogRepository } from "../infrastructure/prisma/prisma-audit-log-repository.js";
import { PrismaAuditRepository } from "../infrastructure/prisma/prisma-audit-repository.js";
import { PrismaBriefingAnswerRepository } from "../infrastructure/prisma/prisma-briefing-answer-repository.js";
import { PrismaBriefingFileRepository } from "../infrastructure/prisma/prisma-briefing-file-repository.js";
import { PrismaBriefingRepository } from "../infrastructure/prisma/prisma-briefing-repository.js";
import { PrismaBriefingTemplateRepository } from "../infrastructure/prisma/prisma-briefing-template-repository.js";
import { PrismaCompanyRepository } from "../infrastructure/prisma/prisma-company-repository.js";
import { PrismaLeadRepository } from "../infrastructure/prisma/prisma-lead-repository.js";
import { PrismaContractRepository } from "../infrastructure/prisma/prisma-contract-repository.js";
import { PrismaLandingPageRepository } from "../infrastructure/prisma/prisma-landing-page-repository.js";
import { PrismaMeetingRepository } from "../infrastructure/prisma/prisma-meeting-repository.js";
import { PrismaMessageRepository } from "../infrastructure/prisma/prisma-message-repository.js";
import { PrismaMessageTemplateRepository } from "../infrastructure/prisma/prisma-message-template-repository.js";
import { PrismaMembershipRepository } from "../infrastructure/prisma/prisma-membership-repository.js";
import { PrismaOrganizationRepository } from "../infrastructure/prisma/prisma-organization-repository.js";
import { PrismaPipelineRepository } from "../infrastructure/prisma/prisma-pipeline-repository.js";
import { PrismaProposalRepository } from "../infrastructure/prisma/prisma-proposal-repository.js";
import { PrismaRefreshTokenRepository } from "../infrastructure/prisma/prisma-refresh-token-repository.js";
import { PrismaRoleRepository } from "../infrastructure/prisma/prisma-role-repository.js";
import { PrismaTagRepository } from "../infrastructure/prisma/prisma-tag-repository.js";
import { PrismaTaskRepository } from "../infrastructure/prisma/prisma-task-repository.js";
import { PrismaUserRepository } from "../infrastructure/prisma/prisma-user-repository.js";
import { createAuthenticateMiddleware } from "../interfaces/http/middlewares/authenticate.js";
import { AiController } from "../interfaces/http/controllers/ai-controller.js";
import { AuditController } from "../interfaces/http/controllers/audit-controller.js";
import { AuthController } from "../interfaces/http/controllers/auth-controller.js";
import { BriefingController } from "../interfaces/http/controllers/briefing-controller.js";
import { ContractController } from "../interfaces/http/controllers/contract-controller.js";
import { LandingPageController } from "../interfaces/http/controllers/landing-page-controller.js";
import { MessageController } from "../interfaces/http/controllers/message-controller.js";
import { CompanyController } from "../interfaces/http/controllers/company-controller.js";
import { LeadController } from "../interfaces/http/controllers/lead-controller.js";
import { MeetingController } from "../interfaces/http/controllers/meeting-controller.js";
import { PipelineController } from "../interfaces/http/controllers/pipeline-controller.js";
import { ProposalController } from "../interfaces/http/controllers/proposal-controller.js";
import { SettingsController } from "../interfaces/http/controllers/settings-controller.js";
import { TagController } from "../interfaces/http/controllers/tag-controller.js";
import { TaskController } from "../interfaces/http/controllers/task-controller.js";
import type { MembershipRepository } from "../domain/repositories/membership-repository.js";
import type { RequestHandler } from "express";

export interface Container {
  aiController: AiController;
  auditController: AuditController;
  authController: AuthController;
  briefingController: BriefingController;
  companyController: CompanyController;
  contractController: ContractController;
  landingPageController: LandingPageController;
  messageController: MessageController;
  leadController: LeadController;
  meetingController: MeetingController;
  pipelineController: PipelineController;
  proposalController: ProposalController;
  settingsController: SettingsController;
  tagController: TagController;
  taskController: TaskController;
  authenticate: RequestHandler;
  membershipRepository: MembershipRepository;
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
  const refreshTokenRepository = new PrismaRefreshTokenRepository();
  const auditLogRepository = new PrismaAuditLogRepository();
  const companyRepository = new PrismaCompanyRepository();
  const activityRepository = new PrismaActivityRepository();
  const pipelineRepository = new PrismaPipelineRepository();
  const tagRepository = new PrismaTagRepository();
  const leadRepository = new PrismaLeadRepository();
  const taskRepository = new PrismaTaskRepository();
  const meetingRepository = new PrismaMeetingRepository();
  const proposalRepository = new PrismaProposalRepository();
  const auditRepository = new PrismaAuditRepository();
  const messageRepository = new PrismaMessageRepository();
  const messageTemplateRepository = new PrismaMessageTemplateRepository();
  const landingPageRepository = new PrismaLandingPageRepository();
  const contractRepository = new PrismaContractRepository();
  const briefingRepository = new PrismaBriefingRepository();
  const briefingTemplateRepository = new PrismaBriefingTemplateRepository();
  const briefingAnswerRepository = new PrismaBriefingAnswerRepository();
  const briefingFileRepository = new PrismaBriefingFileRepository();

  // ---- Serviços ----
  const passwordHasher = new BcryptPasswordHasher();
  const accessTokenService = new JwtAccessTokenService();
  const auditLogger = new AuditLogger(auditLogRepository);
  const activityLogger = new ActivityLogger(activityRepository);
  const sessionIssuer = new SessionIssuer(accessTokenService, refreshTokenRepository);
  const companyService = new CompanyService(companyRepository);
  const leadService = new LeadService(leadRepository, pipelineRepository, activityLogger);
  const pipelineService = new PipelineService(pipelineRepository);
  const tagService = new TagService(tagRepository);
  const taskService = new TaskService(taskRepository);
  const meetingService = new MeetingService(meetingRepository);
  const proposalService = new ProposalService(
    proposalRepository,
    activityLogger,
    leadRepository,
    organizationRepository,
    new DefaultProposalNotifier(),
  );
  const settingsService = new SettingsService(userRepository, organizationRepository);
  const auditService = new AuditService(auditRepository, companyRepository, new BullAuditQueue());
  const messageService = new MessageService(
    messageRepository,
    messageTemplateRepository,
    activityLogger,
  );
  // IA é opcional: sem chave, o service existe mas recusa com 503 amigável.
  const leadAi = env.ANTHROPIC_API_KEY
    ? new ClaudeLeadAi(env.ANTHROPIC_API_KEY, env.AI_MODEL)
    : null;
  const landingPageService = new LandingPageService(
    landingPageRepository,
    companyRepository,
    new BullLandingPageQueue(),
    !!env.ANTHROPIC_API_KEY,
  );
  const contractService = new ContractService(
    contractRepository,
    companyRepository,
    organizationRepository,
    new BullContractQueue(),
    createSignatureGateway(),
    new DefaultContractNotifier(),
  );
  const blobStorage = new VercelBlobStorage();
  const briefingService = new BriefingService(
    briefingRepository,
    briefingTemplateRepository,
    new DefaultBriefingNotifier(),
    activityLogger,
  );
  const briefingAnswerService = new BriefingAnswerService(briefingRepository, briefingAnswerRepository);
  const briefingCompletionService = new BriefingCompletionService(
    briefingRepository,
    briefingAnswerRepository,
    new BullBriefingQueue(),
    activityLogger,
  );
  const briefingFileService = new BriefingFileService(briefingRepository, briefingFileRepository, blobStorage);
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
  const logoutUseCase = new LogoutUseCase(refreshTokenRepository, auditLogger);
  const getCurrentUserUseCase = new GetCurrentUserUseCase(userRepository, membershipRepository);

  // ---- Controllers & middlewares ----
  const authController = new AuthController(
    registerUseCase,
    loginUseCase,
    refreshUseCase,
    logoutUseCase,
    getCurrentUserUseCase,
  );
  const companyController = new CompanyController(companyService);
  const leadController = new LeadController(leadService);
  const pipelineController = new PipelineController(pipelineService);
  const tagController = new TagController(tagService);
  const taskController = new TaskController(taskService);
  const meetingController = new MeetingController(meetingService);
  const proposalController = new ProposalController(proposalService);
  const settingsController = new SettingsController(settingsService);
  const auditController = new AuditController(auditService);
  const aiController = new AiController(aiService);
  const messageController = new MessageController(messageService);
  const landingPageController = new LandingPageController(landingPageService);
  const contractController = new ContractController(contractService);
  const briefingController = new BriefingController(
    briefingService,
    briefingAnswerService,
    briefingCompletionService,
    briefingFileService,
  );
  const authenticate = createAuthenticateMiddleware(accessTokenService, membershipRepository);

  return {
    aiController,
    auditController,
    authController,
    briefingController,
    contractController,
    landingPageController,
    messageController,
    companyController,
    leadController,
    meetingController,
    pipelineController,
    proposalController,
    settingsController,
    tagController,
    taskController,
    authenticate,
    membershipRepository,
  };
}
