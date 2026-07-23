import type { BriefingTemplate, BriefingTemplateDetail } from "../../domain/entities/briefing.js";
import type {
  BriefingTemplateRepository,
  CreateCustomTemplateInput,
} from "../../domain/repositories/briefing-template-repository.js";
import { TtlCache } from "../cache/ttl-cache.js";

const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Decorator que cacheia `findById`/`findByKey` em memória. A estrutura de um
 * template (seções+campos) só muda por `pnpm db:seed` manual (reinicia o
 * processo, o que já limpa o cache sozinho) -- então o TTL de 5min aqui é só
 * uma trava de segurança, não uma janela de staleness esperada de verdade.
 * Existe pra tirar do caminho quente do formulário público (getByToken e
 * TODO autosave) a consulta aninhada seções->campos, que hoje roda de novo
 * a cada request mesmo sem nada ter mudado.
 */
export class CachedBriefingTemplateRepository implements BriefingTemplateRepository {
  private readonly byId = new TtlCache<string, BriefingTemplateDetail | null>(
    TEMPLATE_CACHE_TTL_MS,
  );
  private readonly byKey = new TtlCache<string, BriefingTemplateDetail | null>(
    TEMPLATE_CACHE_TTL_MS,
  );

  constructor(private readonly inner: BriefingTemplateRepository) {}

  list(): Promise<BriefingTemplate[]> {
    return this.inner.list();
  }

  findById(id: string): Promise<BriefingTemplateDetail | null> {
    return this.byId.getOrCompute(id, () => this.inner.findById(id));
  }

  findByKey(key: string, organizationId: string): Promise<BriefingTemplateDetail | null> {
    return this.byKey.getOrCompute(`${key}:${organizationId}`, () =>
      this.inner.findByKey(key, organizationId),
    );
  }

  createCustom(input: CreateCustomTemplateInput): Promise<BriefingTemplateDetail> {
    return this.inner.createCustom(input);
  }
}
