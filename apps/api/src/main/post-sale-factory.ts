import { PostSaleOnboardingService } from "../application/services/post-sale-onboarding-service.js";
import { ActivityLogger } from "../application/services/activity-logger.js";
import { BriefingService } from "../application/services/briefing-service.js";
import { CostService } from "../application/services/cost-service.js";
import { EstimateService } from "../application/services/estimate-service.js";
import { LeadService } from "../application/services/lead-service.js";
import { ProjectChecklistService } from "../application/services/project-checklist-service.js";
import { ReceivableService } from "../application/services/receivable-service.js";
import { TaskService } from "../application/services/task-service.js";
import { env } from "../config/env.js";
import { VercelBlobStorage } from "../infrastructure/blob/vercel-blob-storage.js";
import { DefaultBriefingNotifier } from "../infrastructure/briefings/notifications/briefing-notifier.js";
import { CachedBriefingTemplateRepository } from "../infrastructure/prisma/cached-briefing-template-repository.js";
import { PrismaActivityRepository } from "../infrastructure/prisma/prisma-activity-repository.js";
import { PrismaBriefingRepository } from "../infrastructure/prisma/prisma-briefing-repository.js";
import { PrismaBriefingTemplateRepository } from "../infrastructure/prisma/prisma-briefing-template-repository.js";
import { PrismaCompanyRepository } from "../infrastructure/prisma/prisma-company-repository.js";
import { PrismaContractRepository } from "../infrastructure/prisma/prisma-contract-repository.js";
import { PrismaCostRepository } from "../infrastructure/prisma/prisma-cost-repository.js";
import { PrismaEstimateRepository } from "../infrastructure/prisma/prisma-estimate-repository.js";
import { PrismaLeadRepository } from "../infrastructure/prisma/prisma-lead-repository.js";
import { PrismaMembershipRepository } from "../infrastructure/prisma/prisma-membership-repository.js";
import { PrismaPipelineRepository } from "../infrastructure/prisma/prisma-pipeline-repository.js";
import { PrismaPostSaleAutomationRepository } from "../infrastructure/prisma/prisma-post-sale-automation-repository.js";
import { PrismaProjectChecklistRepository } from "../infrastructure/prisma/prisma-project-checklist-repository.js";
import { PrismaProposalRepository } from "../infrastructure/prisma/prisma-proposal-repository.js";
import { PrismaReceivableRepository } from "../infrastructure/prisma/prisma-receivable-repository.js";
import { PrismaOrganizationRepository } from "../infrastructure/prisma/prisma-organization-repository.js";
import { PrismaTaskRepository } from "../infrastructure/prisma/prisma-task-repository.js";
import { WebPushSender } from "../infrastructure/push/web-push-sender.js";
import { PgBossPostSaleQueue } from "../infrastructure/queue/pg-post-sale-queue.js";

/**
 * Montagem do orquestrador pós-fechamento num lugar só.
 *
 * Existe separado do `container.ts` porque DOIS processos precisam dele com
 * grafos de dependência diferentes: a API (que também precisa dos
 * controllers) e o worker (`interfaces/jobs/post-sale.worker.ts`, que só
 * precisa do service). Sem esta fábrica, o worker recriaria à mão a mesma
 * dúzia de repositórios -- e a próxima dependência nova entraria em um dos
 * dois lugares e não no outro.
 */
export function buildPostSaleOnboardingService(): PostSaleOnboardingService {
  const activityRepository = new PrismaActivityRepository();
  const companyRepository = new PrismaCompanyRepository();
  const contractRepository = new PrismaContractRepository();
  const leadRepository = new PrismaLeadRepository();
  const pipelineRepository = new PrismaPipelineRepository();
  const receivableRepository = new PrismaReceivableRepository();
  const taskRepository = new PrismaTaskRepository();
  // Leads e tarefas validam o responsável contra o vínculo ativo da
  // organização (módulo de equipe) -- a automação passa pelos mesmos
  // services, então herda a checagem em vez de duplicá-la.
  const membershipRepository = new PrismaMembershipRepository();
  const projectChecklistRepository = new PrismaProjectChecklistRepository();
  const estimateRepository = new PrismaEstimateRepository();
  const proposalRepository = new PrismaProposalRepository();
  const organizationRepository = new PrismaOrganizationRepository();
  const costRepository = new PrismaCostRepository();
  const briefingTemplateRepository = new CachedBriefingTemplateRepository(
    new PrismaBriefingTemplateRepository(),
  );
  const briefingRepository = new PrismaBriefingRepository(briefingTemplateRepository);

  const activityLogger = new ActivityLogger(activityRepository);
  const blobStorage = new VercelBlobStorage();
  const costService = new CostService(costRepository, companyRepository);
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

  return new PostSaleOnboardingService({
    automation: new PrismaPostSaleAutomationRepository(),
    contracts: contractRepository,
    companies: companyRepository,
    leads: leadRepository,
    memberships: membershipRepository,
    pipelines: pipelineRepository,
    receivables: receivableRepository,
    leadService: new LeadService(
      leadRepository,
      pipelineRepository,
      activityLogger,
      membershipRepository,
    ),
    receivableService: new ReceivableService(
      receivableRepository,
      contractRepository,
      estimateService,
    ),
    briefingService: new BriefingService(
      briefingRepository,
      briefingTemplateRepository,
      new DefaultBriefingNotifier(),
      activityLogger,
      companyRepository,
      leadRepository,
    ),
    projectChecklistService: new ProjectChecklistService(
      projectChecklistRepository,
      companyRepository,
      leadRepository,
      contractRepository,
    ),
    taskService: new TaskService(taskRepository, membershipRepository),
    activityLogger,
    push: new WebPushSender(),
    queue: new PgBossPostSaleQueue(),
    webPublicUrl: env.WEB_PUBLIC_URL,
  });
}
