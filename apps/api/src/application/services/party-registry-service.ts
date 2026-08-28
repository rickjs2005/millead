import type { PersonalCatalogRepository } from "../../domain/repositories/personal-catalog-repository.js";
import type { PersonalDebtRepository } from "../../domain/repositories/personal-debt-repository.js";
import type { EnsuredParty, PartyRegistry } from "../../domain/services/party-registry.js";
import { normalizeDescription } from "./transaction-text.js";

/**
 * Cadastra a contraparte quando ela ainda não existe.
 *
 * ## Idempotência é o requisito, não um detalhe
 *
 * Seis extratos do mesmo semestre trazem a mesma pessoa dezenas de vezes. Se
 * cada linha criasse um registro, "Pessoas" viraria a lista de linhas do
 * extrato — o oposto do que ela é. Por isso a comparação é por nome
 * **normalizado**: "SAMILI LINDA" e "Samili Linda" são a mesma pessoa, e o
 * banco escreve o nome de um jeito diferente em cada arquivo.
 *
 * ## Por que não há chave única no banco
 *
 * Porque o nome não é identidade: duas pessoas podem se chamar igual, e você
 * pode querer as duas cadastradas. A unicidade aqui é uma conveniência da
 * importação (não repetir o que ela mesma acabou de criar), não uma regra do
 * domínio. Uma constraint transformaria um homônimo legítimo em erro 500 no
 * meio de uma importação.
 */
export class PartyRegistryService implements PartyRegistry {
  constructor(
    private readonly catalog: PersonalCatalogRepository,
    private readonly debts: PersonalDebtRepository,
  ) {}

  async ensurePerson(vaultId: string, name: string): Promise<EnsuredParty> {
    const alvo = chaveDeNome(name);
    // Inclui inativos: quem desativou um contato não quer vê-lo voltar
    // duplicado na próxima importação.
    const existentes = await this.debts.listContacts(vaultId, true);
    const achado = existentes.find((c) => chaveDeNome(c.name) === alvo);
    if (achado) return { id: achado.id, created: false };

    const criado = await this.debts.createContact(vaultId, {
      name,
      contact: null,
      // A nota diz de onde veio. Sem isso, você abre Pessoas meses depois e
      // não sabe se cadastrou à mão ou se o sistema cadastrou por você.
      notes: "Cadastrado automaticamente a partir de uma importação de extrato.",
    });
    return { id: criado.id, created: true };
  }

  async ensureMerchant(vaultId: string, name: string): Promise<EnsuredParty> {
    const alvo = chaveDeNome(name);
    const existentes = await this.catalog.listMerchants(vaultId, true);
    const achado = existentes.find(
      (m) => chaveDeNome(m.name) === alvo || m.aliases.some((a) => chaveDeNome(a.alias) === alvo),
    );
    if (achado) return { id: achado.id, created: false };

    const criado = await this.catalog.createMerchant(vaultId, {
      name,
      defaultCategoryId: null,
      // O alias é o nome normalizado: é por ele que a classificação vai
      // reencontrar este fornecedor nas próximas importações.
      aliases: [normalizeDescription(name)],
    });
    return { id: criado.id, created: true };
  }
}

/**
 * Chave de comparação: sem acento, sem caixa, sem pontuação, sem espaço duplo.
 *
 * `normalizeDescription` faz o trabalho pesado e é a MESMA função que a
 * deduplicação usa — o que garante que os dois lados do sistema concordem
 * sobre o que é "o mesmo nome".
 */
function chaveDeNome(name: string): string {
  return normalizeDescription(name)
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
