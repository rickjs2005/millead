import type { ContractStatus, ContractType } from "@millead/database";
import type {
  Contract,
  ContractDetail,
  ContractedSnapshot,
  ContractorSnapshot,
} from "../entities/contract.js";
import type { PaginatedResult, PaginationParams } from "../../shared/pagination.js";

export interface CreateContractInput {
  organizationId: string;
  companyId: string;
  leadId?: string | null;
  createdById?: string | null;
  /** Prefixo do número (ex.: "MILWEB") -- vem do slug da organização. */
  numeroPrefix: string;
  tipo: ContractType;
  descricaoProjeto: string;
  valorTotal: string;
  formaPagamento: Contract["formaPagamento"];
  percentualEntrada: string;
  prazoEntregaDias: number;
  limiteRevisoes: number;
  contractorSnapshot: ContractorSnapshot;
  contractedSnapshot: ContractedSnapshot;
  provider: Contract["provider"];
  /** Origem do evento CRIADO (APP | PUBLIC_FORM). */
  origem: string;
}

export interface ContractFilters {
  status?: ContractStatus;
  tipo?: ContractType;
  companyId?: string;
  /** Busca por número ou nome da empresa. */
  search?: string;
}

export interface ContractKpis {
  total: number;
  aguardandoAssinatura: number;
  assinados: number;
  /** Soma de valorTotal dos ASSINADOS (string decimal). */
  valorFechado: string;
}

export interface ContractRepository {
  /** Transacional: sequência org+ano -> número -> contrato + signatário CONTRATANTE + evento CRIADO. */
  create(input: CreateContractInput): Promise<Contract>;
  findByIdForOrg(id: string, organizationId: string): Promise<ContractDetail | null>;
  findBySignatureDocId(docId: string): Promise<Contract | null>;
  list(
    organizationId: string,
    filters: ContractFilters,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Contract>>;
  kpis(organizationId: string): Promise<ContractKpis>;
  updateStatus(id: string, organizationId: string, status: ContractStatus): Promise<Contract | null>;
  savePdfOriginal(id: string, pdf: Buffer): Promise<void>;
  setSignatureDoc(id: string, docId: string, signUrl: string): Promise<void>;
  markSigned(id: string, assinadoEm: Date, pdfAssinado?: Buffer | null, ip?: string | null): Promise<Contract | null>;
  addEvent(
    contractId: string,
    organizationId: string,
    tipo: string,
    origem: string,
    payload?: unknown,
  ): Promise<void>;
  getPdf(id: string, organizationId: string, versao: "original" | "assinado"): Promise<Buffer | null>;
}
