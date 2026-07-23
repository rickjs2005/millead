/**
 * Cache genérico em memória com expiração por TTL. Escopo: processo único
 * da API (Render roda uma instância; sem necessidade de invalidação
 * cross-instância). Feito pra evitar refazer no Postgres uma consulta cara
 * de algo que muda raramente (ex.: estrutura de um BriefingTemplate).
 */
export class TtlCache<K, V> {
  private readonly store = new Map<K, { value: V; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async getOrCompute(key: K, compute: () => Promise<V>): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await compute();
    this.set(key, value);
    return value;
  }
}
