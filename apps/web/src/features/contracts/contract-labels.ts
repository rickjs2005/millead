import type { ContractPaymentMethod, ContractStatus, ContractType } from "@/types/api";

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  SITE: "Site",
  SISTEMA: "Sistema",
  SAAS: "SaaS",
  MANUTENCAO: "Manutenção",
  CONSULTORIA: "Consultoria",
};

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  RASCUNHO: "Rascunho",
  VALIDADO: "Validado",
  PDF_GERADO: "PDF gerado",
  AGUARDANDO_ASSINATURA: "Aguardando assinatura",
  ASSINADO: "Assinado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
};

export const CONTRACT_STATUS_VARIANT: Record<
  ContractStatus,
  "default" | "success" | "secondary" | "destructive" | "outline"
> = {
  RASCUNHO: "secondary",
  VALIDADO: "secondary",
  PDF_GERADO: "default",
  AGUARDANDO_ASSINATURA: "default",
  ASSINADO: "success",
  CANCELADO: "destructive",
  EXPIRADO: "outline",
};

export const CONTRACT_PAYMENT_LABELS: Record<ContractPaymentMethod, string> = {
  PIX: "PIX",
  BOLETO: "Boleto",
  CARTAO: "Cartão",
  TRANSFERENCIA: "Transferência",
  PARCELADO: "Parcelado",
};

export const CONTRACT_EVENT_LABELS: Record<string, string> = {
  CRIADO: "Contrato criado",
  PDF_GERADO: "PDF gerado",
  ENVIADO: "Enviado pra assinatura",
  CONVITE_ENVIADO: "Convite enviado",
  VISUALIZADO: "Visualizado pelo cliente",
  ASSINADO: "Assinado",
  REPROCESSAMENTO: "Reprocessamento solicitado",
  FALHA_PROCESSAMENTO: "Falha no processamento",
  STATUS_CANCELADO: "Cancelado manualmente",
  STATUS_EXPIRADO: "Marcado como expirado",
  STATUS_AGUARDANDO_ASSINATURA: "Reaberto pra assinatura",
};

/** Status em que o worker ainda está trabalhando (a UI faz polling). */
export const CONTRACT_PENDING_STATUSES: ContractStatus[] = ["RASCUNHO", "VALIDADO", "PDF_GERADO"];
