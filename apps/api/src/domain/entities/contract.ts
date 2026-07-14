import type {
  ContractPaymentMethod,
  ContractSignatureProvider,
  ContractStatus,
  ContractType,
} from "@millead/database";

/** Dados do contratante congelados no momento do contrato. */
export interface ContractorSnapshot {
  tipoPessoa: "PF" | "PJ";
  nome: string;
  documento: string; // só dígitos (CPF/CNPJ)
  email: string;
  telefone: string;
  endereco: string;
  nomeEmpresa?: string | null;
}

/** Dados da contratada (a agência) congelados no momento do contrato. */
export interface ContractedSnapshot {
  razaoSocial: string;
  cnpj: string;
  docLabel: string;
  endereco: string;
  email: string;
  foro: string;
}

export interface Contract {
  id: string;
  organizationId: string;
  companyId: string;
  leadId: string | null;
  createdById: string | null;
  numero: string;
  tipo: ContractType;
  status: ContractStatus;
  descricaoProjeto: string;
  valorTotal: string; // Decimal serializa como string
  formaPagamento: ContractPaymentMethod;
  percentualEntrada: string;
  prazoEntregaDias: number;
  limiteRevisoes: number;
  contractorSnapshot: unknown;
  contractedSnapshot: unknown;
  provider: ContractSignatureProvider;
  signatureDocId: string | null;
  signatureUrl: string | null;
  assinadoEm: Date | null;
  hasPdfOriginal: boolean;
  hasPdfAssinado: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractSigner {
  id: string;
  contractId: string;
  nome: string;
  email: string;
  papel: string;
  assinadoEm: Date | null;
  ip: string | null;
  createdAt: Date;
}

export interface ContractEvent {
  id: string;
  contractId: string;
  tipo: string;
  origem: string;
  payload: unknown;
  createdAt: Date;
}

export interface ContractDetail extends Contract {
  signers: ContractSigner[];
  events: ContractEvent[];
}
