import type { AuditRepository } from "../../domain/repositories/audit-repository.js";
import type { SiteAuditor } from "../../domain/services/site-auditor.js";

/**
 * Executa uma auditoria de site do início ao fim -- chamado SOMENTE pelo
 * worker BullMQ (interfaces/jobs/audit.worker.ts), nunca pelo servidor
 * HTTP. Idempotente: um retry do job re-roda a análise e sobrescreve
 * report/scores (o repositório usa upsert/replace).
 */
export class AuditRunner {
  constructor(
    private readonly audits: AuditRepository,
    private readonly auditor: SiteAuditor,
  ) {}

  async run(auditId: string, url: string): Promise<void> {
    await this.audits.markRunning(auditId);
    try {
      const result = await this.auditor.audit(url);
      await this.audits.saveResult(auditId, {
        summary: result.summary,
        rawData: result.rawData,
        scores: result.categories.map((c) => ({
          category: c.category,
          score: c.score,
          details: { checks: c.checks },
        })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha desconhecida na auditoria.";
      await this.audits.markFailed(auditId, `Não foi possível auditar ${url}: ${message}`);
      // Rethrow pro BullMQ registrar a falha e aplicar a política de retry.
      throw err;
    }
  }
}
