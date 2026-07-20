import { api } from "./api-client";
import type {
  Contract,
  ContractDetail,
  ContractKpis,
  ContractPaymentMethod,
  ContractStatus,
  ContractType,
  PaginatedResult,
} from "@/types/api";

export interface CreateContractPayload {
  tipoPessoa: "PF" | "PJ";
  nome: string;
  documento: string;
  email: string;
  telefone: string;
  endereco: string;
  nomeEmpresa?: string;
  tipo: ContractType;
  descricaoProjeto: string;
  valorTotal: number;
  formaPagamento: ContractPaymentMethod;
  percentualEntrada: number;
  prazoEntregaDias: number;
  limiteRevisoes?: number;
  leadId?: string;
}

export interface ListContractsParams {
  page?: number;
  pageSize?: number;
  status?: ContractStatus;
  tipo?: ContractType;
  companyId?: string;
  search?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const contractsService = {
  list: (params: ListContractsParams = {}) =>
    api.get<PaginatedResult<Contract>>("/api/v1/contracts", params),

  kpis: () => api.get<ContractKpis>("/api/v1/contracts/kpis"),

  get: (id: string) => api.get<ContractDetail>(`/api/v1/contracts/${id}`),

  create: (payload: CreateContractPayload) => api.post<Contract>("/api/v1/contracts", payload),

  updateStatus: (id: string, status: "CANCELADO" | "EXPIRADO" | "AGUARDANDO_ASSINATURA") =>
    api.patch<Contract>(`/api/v1/contracts/${id}/status`, { status }),

  reprocess: (id: string) => api.post<Contract>(`/api/v1/contracts/${id}/reprocess`),

  /**
   * Baixa o PDF (rota autenticada) via BFF e abre numa aba nova. O token está
   * em cookie httpOnly, então o proxy anexa o Bearer server-side; num 401,
   * tenta um refresh e repete uma vez.
   */
  async openPdf(id: string, versao: "original" | "assinado"): Promise<void> {
    const url = `/api/bff/api/v1/contracts/${id}/pdf?versao=${versao}`;
    let res = await fetch(url, { credentials: "include" });
    if (res.status === 401) {
      const refreshed = await fetch("/api/bff/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (refreshed.ok) res = await fetch(url, { credentials: "include" });
    }
    if (!res.ok) throw new Error("PDF indisponível.");
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  },
};

/** Cria contrato via formulário PÚBLICO (sem login). */
export async function createPublicContract(
  organizationSlug: string,
  payload: CreateContractPayload,
): Promise<{ numero: string; status: ContractStatus }> {
  const res = await fetch(`${API_BASE}/api/v1/public/contracts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationSlug, ...payload }),
  });
  const body = (await res.json()) as
    { numero: string; status: ContractStatus } | { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(
      ("error" in body && body.error?.message) || "Não foi possível enviar o contrato.",
    );
  }
  return body as { numero: string; status: ContractStatus };
}
