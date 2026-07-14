import { prisma, Prisma } from "@millead/database";
import type {
  Contract,
  ContractDetail,
} from "../../domain/entities/contract.js";
import type {
  ContractFilters,
  ContractKpis,
  ContractRepository,
  CreateContractInput,
} from "../../domain/repositories/contract-repository.js";
import {
  paginate,
  toSkipTake,
  type PaginatedResult,
  type PaginationParams,
} from "../../shared/pagination.js";
import type { ContractStatus } from "@millead/database";

// Seleção sem os Bytes dos PDFs (pesados) -- hasPdf* vem de flags derivadas.
const baseSelect = {
  id: true,
  organizationId: true,
  companyId: true,
  leadId: true,
  createdById: true,
  numero: true,
  tipo: true,
  status: true,
  descricaoProjeto: true,
  valorTotal: true,
  formaPagamento: true,
  percentualEntrada: true,
  prazoEntregaDias: true,
  limiteRevisoes: true,
  contractorSnapshot: true,
  contractedSnapshot: true,
  provider: true,
  signatureDocId: true,
  signatureUrl: true,
  assinadoEm: true,
  createdAt: true,
  updatedAt: true,
} as const;

type Row = Prisma.ContractGetPayload<{ select: typeof baseSelect }> & {
  pdfOriginal?: Uint8Array | null;
  pdfAssinado?: Uint8Array | null;
};

function toDomain(row: Row, hasPdfOriginal: boolean, hasPdfAssinado: boolean): Contract {
  return {
    ...row,
    valorTotal: row.valorTotal.toString(),
    percentualEntrada: row.percentualEntrada.toString(),
    hasPdfOriginal,
    hasPdfAssinado,
  };
}

export class PrismaContractRepository implements ContractRepository {
  async create(input: CreateContractInput): Promise<Contract> {
    const ano = new Date().getFullYear();
    const row = await prisma.$transaction(async (tx) => {
      const seq = await tx.contractSequence.upsert({
        where: { organizationId_ano: { organizationId: input.organizationId, ano } },
        create: { organizationId: input.organizationId, ano, ultimo: 1 },
        update: { ultimo: { increment: 1 } },
      });
      const numero = `${input.numeroPrefix}-${ano}-${String(seq.ultimo).padStart(6, "0")}`;

      const contract = await tx.contract.create({
        data: {
          organizationId: input.organizationId,
          companyId: input.companyId,
          leadId: input.leadId ?? null,
          createdById: input.createdById ?? null,
          numero,
          tipo: input.tipo,
          descricaoProjeto: input.descricaoProjeto,
          valorTotal: input.valorTotal,
          formaPagamento: input.formaPagamento,
          percentualEntrada: input.percentualEntrada,
          prazoEntregaDias: input.prazoEntregaDias,
          limiteRevisoes: input.limiteRevisoes,
          contractorSnapshot: input.contractorSnapshot as unknown as Prisma.InputJsonValue,
          contractedSnapshot: input.contractedSnapshot as unknown as Prisma.InputJsonValue,
          provider: input.provider,
        },
        select: baseSelect,
      });

      await tx.contractSigner.create({
        data: {
          organizationId: input.organizationId,
          contractId: contract.id,
          nome: input.contractorSnapshot.nome,
          email: input.contractorSnapshot.email,
          papel: "CONTRATANTE",
        },
      });
      await tx.contractEvent.create({
        data: {
          organizationId: input.organizationId,
          contractId: contract.id,
          tipo: "CRIADO",
          origem: input.origem,
        },
      });
      return contract;
    });
    return toDomain(row, false, false);
  }

  async findByIdForOrg(id: string, organizationId: string): Promise<ContractDetail | null> {
    const row = await prisma.contract.findFirst({
      where: { id, organizationId },
      select: {
        ...baseSelect,
        pdfOriginal: true,
        pdfAssinado: true,
        signers: { orderBy: { createdAt: "asc" } },
        events: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!row) return null;
    const { pdfOriginal, pdfAssinado, signers, events, ...rest } = row;
    return {
      ...toDomain(rest as Row, pdfOriginal !== null, pdfAssinado !== null),
      signers,
      events,
    };
  }

  async findBySignatureDocId(docId: string): Promise<Contract | null> {
    const row = await prisma.contract.findFirst({
      where: { signatureDocId: docId },
      select: baseSelect,
    });
    return row ? toDomain(row, true, false) : null;
  }

  async list(
    organizationId: string,
    filters: ContractFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Contract>> {
    const where: Prisma.ContractWhereInput = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.tipo ? { tipo: filters.tipo } : {}),
      ...(filters.companyId ? { companyId: filters.companyId } : {}),
      ...(filters.search
        ? {
            OR: [
              { numero: { contains: filters.search, mode: "insensitive" } },
              { company: { name: { contains: filters.search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        select: baseSelect,
        orderBy: { createdAt: "desc" },
        ...toSkipTake(pagination),
      }),
      prisma.contract.count({ where }),
    ]);
    return paginate(
      rows.map((r) => toDomain(r, false, false)),
      total,
      pagination,
    );
  }

  async kpis(organizationId: string): Promise<ContractKpis> {
    const [total, aguardando, assinados, soma] = await Promise.all([
      prisma.contract.count({ where: { organizationId } }),
      prisma.contract.count({ where: { organizationId, status: "AGUARDANDO_ASSINATURA" } }),
      prisma.contract.count({ where: { organizationId, status: "ASSINADO" } }),
      prisma.contract.aggregate({
        where: { organizationId, status: "ASSINADO" },
        _sum: { valorTotal: true },
      }),
    ]);
    return {
      total,
      aguardandoAssinatura: aguardando,
      assinados,
      valorFechado: (soma._sum.valorTotal ?? new Prisma.Decimal(0)).toString(),
    };
  }

  async updateStatus(
    id: string,
    organizationId: string,
    status: ContractStatus,
  ): Promise<Contract | null> {
    const { count } = await prisma.contract.updateMany({
      where: { id, organizationId },
      data: { status },
    });
    if (count === 0) return null;
    const row = await prisma.contract.findUniqueOrThrow({ where: { id }, select: baseSelect });
    return toDomain(row, false, false);
  }

  async savePdfOriginal(id: string, pdf: Buffer): Promise<void> {
    await prisma.contract.update({
      where: { id },
      data: { pdfOriginal: new Uint8Array(pdf), status: "PDF_GERADO" },
    });
  }

  async setSignatureDoc(id: string, docId: string, signUrl: string): Promise<void> {
    await prisma.contract.update({
      where: { id },
      data: { signatureDocId: docId, signatureUrl: signUrl, status: "AGUARDANDO_ASSINATURA" },
    });
  }

  async markSigned(
    id: string,
    assinadoEm: Date,
    pdfAssinado?: Buffer | null,
    ip?: string | null,
  ): Promise<Contract | null> {
    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id },
        data: {
          status: "ASSINADO",
          assinadoEm,
          ...(pdfAssinado ? { pdfAssinado: new Uint8Array(pdfAssinado) } : {}),
        },
        select: baseSelect,
      });
      await tx.contractSigner.updateMany({
        where: { contractId: id, papel: "CONTRATANTE", assinadoEm: null },
        data: { assinadoEm, ip: ip ?? null },
      });
      return updated;
    });
    return toDomain(row, true, !!pdfAssinado);
  }

  async addEvent(
    contractId: string,
    organizationId: string,
    tipo: string,
    origem: string,
    payload?: unknown,
  ): Promise<void> {
    await prisma.contractEvent.create({
      data: {
        organizationId,
        contractId,
        tipo,
        origem,
        payload: payload === undefined ? Prisma.JsonNull : (payload as Prisma.InputJsonValue),
      },
    });
  }

  async getPdf(
    id: string,
    organizationId: string,
    versao: "original" | "assinado",
  ): Promise<Buffer | null> {
    const row = await prisma.contract.findFirst({
      where: { id, organizationId },
      select: { pdfOriginal: versao === "original", pdfAssinado: versao === "assinado" },
    });
    if (!row) return null;
    const bytes = versao === "original" ? row.pdfOriginal : row.pdfAssinado;
    return bytes ? Buffer.from(bytes) : null;
  }
}
