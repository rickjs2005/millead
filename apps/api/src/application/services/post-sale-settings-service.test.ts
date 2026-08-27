import { describe, expect, it, vi } from "vitest";
import type { PipelineStage } from "../../domain/entities/pipeline.js";
import { NotFoundError, ValidationError } from "../../domain/errors/app-error.js";
import type { BriefingTemplateRepository } from "../../domain/repositories/briefing-template-repository.js";
import type { MembershipRepository } from "../../domain/repositories/membership-repository.js";
import type { PipelineRepository } from "../../domain/repositories/pipeline-repository.js";
import { FakePostSaleAutomationRepository } from "./post-sale-fakes.js";
import { missingConfig, PostSaleSettingsService } from "./post-sale-settings-service.js";

const ORG = "org-1";

function fakeStage(overrides: Partial<PipelineStage> = {}): PipelineStage {
  return {
    id: "stage-won",
    organizationId: ORG,
    pipelineId: "pipeline-1",
    name: "Fechado",
    order: 5,
    color: "#22c55e",
    isWon: true,
    isLost: false,
    createdAt: new Date("2026-08-26T12:00:00Z"),
    ...overrides,
  };
}

interface Options {
  stage?: PipelineStage | null;
  template?: { id: string; kind: string } | null;
  isMember?: boolean;
}

function makeService(options: Options = {}) {
  const automation = new FakePostSaleAutomationRepository();
  const pipelines = {
    findStageForOrg: vi.fn(async () => (options.stage === undefined ? fakeStage() : options.stage)),
  } as unknown as PipelineRepository;
  const templates = {
    findByKey: vi.fn(async () =>
      options.template === undefined
        ? { id: "tpl-1", kind: "INSTITUCIONAL" }
        : options.template,
    ),
  } as unknown as BriefingTemplateRepository;
  const memberships = {
    isActiveMember: vi.fn(async () => options.isMember ?? true),
  } as unknown as MembershipRepository;

  return {
    service: new PostSaleSettingsService(automation, pipelines, templates, memberships),
    automation,
    pipelines,
    templates,
    memberships,
  };
}

describe("PostSaleSettingsService.get", () => {
  it("organizacao sem configuracao recebe defaults desligados, nao null", async () => {
    const { service } = makeService();

    const { settings } = await service.get(ORG);

    expect(settings.enabled).toBe(false);
    expect(settings.installmentCount).toBeNull();
  });

  it("lista o que falta configurar junto da configuracao", async () => {
    const { service } = makeService();

    const { missing } = await service.get(ORG);

    expect(missing).toContain("Estágio de ganho do pipeline");
    expect(missing).toContain("Número padrão de parcelas");
  });
});

describe("PostSaleSettingsService.update — validacao de tenant", () => {
  it("estagio de outra organizacao e recusado como nao encontrado", async () => {
    const { service } = makeService({ stage: null });

    await expect(service.update(ORG, { wonStageId: "stage-de-outro-tenant" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("estagio que nao e de ganho e recusado com mensagem acionavel", async () => {
    const { service } = makeService({ stage: fakeStage({ isWon: false, name: "Proposta" }) });

    await expect(service.update(ORG, { wonStageId: "stage-won" })).rejects.toThrow(
      /não está marcado como ganho/,
    );
  });

  it("template inexistente e recusado", async () => {
    const { service } = makeService({ template: null });

    await expect(
      service.update(ORG, { briefingTemplateKey: "nao-existe" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("template CUSTOM nao pode ser padrao (vale pra um envio so)", async () => {
    const { service } = makeService({ template: { id: "tpl-custom", kind: "CUSTOM" } });

    await expect(
      service.update(ORG, { briefingTemplateKey: "custom-abc123" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("responsavel que nao e membro ativo da organizacao e recusado", async () => {
    const { service } = makeService({ isMember: false });

    await expect(service.update(ORG, { defaultOwnerId: "user-de-outro-tenant" })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("configuracao valida e persistida e devolve o que ainda falta", async () => {
    const { service } = makeService();

    const { settings, missing } = await service.update(ORG, {
      enabled: true,
      wonStageId: "stage-won",
      briefingTemplateKey: "institucional-v1",
      projectType: "INSTITUTIONAL",
      defaultOwnerId: "user-1",
      installmentCount: 2,
      entryDueDays: 3,
      firstInstallmentDueDays: 30,
    });

    expect(settings.enabled).toBe(true);
    expect(settings.installmentCount).toBe(2);
    expect(missing).toEqual([]);
  });

  it("null explicito desconfigura um campo ja salvo", async () => {
    const { service } = makeService();
    await service.update(ORG, { wonStageId: "stage-won" });

    const { settings } = await service.update(ORG, { wonStageId: null });

    expect(settings.wonStageId).toBeNull();
  });
});

describe("missingConfig", () => {
  const base = {
    id: "s1",
    organizationId: ORG,
    enabled: true,
    wonStageId: "stage-won",
    briefingTemplateKey: "institucional-v1",
    projectType: "INSTITUTIONAL" as const,
    defaultOwnerId: "user-1",
    createReceivables: true,
    installmentCount: 2,
    entryDueDays: 3,
    firstInstallmentDueDays: 30,
    createBriefing: true,
    createProject: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("configuracao completa nao tem pendencia", () => {
    expect(missingConfig(base)).toEqual([]);
  });

  it("campos financeiros so sao exigidos quando recebimentos estao ligados", () => {
    expect(
      missingConfig({
        ...base,
        createReceivables: false,
        installmentCount: null,
        entryDueDays: null,
        firstInstallmentDueDays: null,
      }),
    ).toEqual([]);
  });

  it("template so e exigido quando briefing automatico esta ligado", () => {
    expect(missingConfig({ ...base, createBriefing: false, briefingTemplateKey: null })).toEqual(
      [],
    );
  });

  it("tipo de projeto so e exigido quando projeto automatico esta ligado", () => {
    expect(missingConfig({ ...base, createProject: false, projectType: null })).toEqual([]);
  });
});
