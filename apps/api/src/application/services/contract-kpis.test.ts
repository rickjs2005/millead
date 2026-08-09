import { describe, expect, it, vi } from "vitest";
import type { CompanyRepository } from "../../domain/repositories/company-repository.js";
import type { ContractKpis, ContractRepository } from "../../domain/repositories/contract-repository.js";
import type { OrganizationRepository } from "../../domain/repositories/organization-repository.js";
import type { ContractNotifier } from "../../domain/services/contract-notifier.js";
import type { ContractQueue } from "../../domain/services/contract-queue.js";
import type { ContractSignatureGateway } from "../../domain/services/contract-signature.js";
import { ContractService } from "./contract-service.js";

const ORG = "org-1";

function makeService(kpis: ReturnType<typeof vi.fn>) {
  const contracts = { kpis } as unknown as ContractRepository;
  const companies = {} as unknown as CompanyRepository;
  const organizations = {} as unknown as OrganizationRepository;
  const queue = {} as unknown as ContractQueue;
  const gateway = {} as unknown as ContractSignatureGateway;
  const notifier = {} as unknown as ContractNotifier;

  return new ContractService(contracts, companies, organizations, queue, gateway, notifier);
}

describe("ContractService.kpis", () => {
  it("propaga organizationId pro repositório e devolve o shape completo (com valorFechadoMes/Ano)", async () => {
    const fakeKpis: ContractKpis = {
      total: 10,
      aguardandoAssinatura: 2,
      assinados: 8,
      valorFechado: "50000.00",
      valorFechadoMes: "8000.00",
      valorFechadoAno: "32000.00",
    };
    const kpis = vi.fn().mockResolvedValue(fakeKpis);
    const service = makeService(kpis);

    const result = await service.kpis(ORG);

    expect(kpis).toHaveBeenCalledWith(ORG);
    expect(result).toEqual(fakeKpis);
    // Aditivo: os campos novos são string, igual valorFechado -- Decimal
    // nunca vaza como number pra fora do repositório.
    expect(typeof result.valorFechadoMes).toBe("string");
    expect(typeof result.valorFechadoAno).toBe("string");
  });
});
