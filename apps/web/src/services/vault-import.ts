import { api } from "./api-client";
import type {
  VaultImportAnalysis,
  VaultImportBatch,
  VaultImportFormat,
  VaultImportPreview,
  VaultImportProfile,
  VaultImportSettings,
} from "@/types/api";

export interface PreviewPayload {
  accountId: string | null;
  cardId: string | null;
  fileName: string;
  /** Conteúdo do arquivo como texto. Nunca é armazenado — nem aqui, nem lá. */
  content: string;
  profileId?: string | null;
  settings?: VaultImportSettings | null;
}

export interface ConfirmPayload {
  accountId: string | null;
  cardId: string | null;
  fileName: string;
  fileHash: string;
  format: VaultImportFormat;
  rows: Array<{
    line: number;
    date: string;
    description: string;
    amount: string;
    direction: "IN" | "OUT";
    externalId: string | null;
  }>;
  ignored: Array<{ line: number; code: string }>;
}

export interface AnalyzePayload {
  fileName: string;
  content: string;
  /** Só quando a pessoa escolhe ou corrige a origem. */
  accountId?: string | null;
  cardId?: string | null;
  profileId?: string | null;
  settings?: VaultImportSettings | null;
}

export const vaultImportService = {
  /**
   * Analisa o arquivo sem exigir conta.
   *
   * Como a pré-visualização, é uma ação, não um estado do servidor — por isso
   * vira mutation nos hooks e nunca entra em cache: o conteúdo do extrato não
   * pode ficar guardado na memória do React Query.
   */
  analyze: (payload: AnalyzePayload) =>
    api.post<VaultImportAnalysis>("/api/v1/vault/imports/analyze", payload),

  preview: (payload: PreviewPayload) =>
    api.post<VaultImportPreview>("/api/v1/vault/imports/preview", payload),
  confirm: (payload: ConfirmPayload) =>
    api.post<VaultImportBatch>("/api/v1/vault/imports", payload),
  history: (limit = 20) => api.get<VaultImportBatch[]>("/api/v1/vault/imports", { limit }),

  listProfiles: () => api.get<VaultImportProfile[]>("/api/v1/vault/imports/profiles"),
  createProfile: (
    payload: VaultImportSettings & {
      name: string;
      accountId: string | null;
      cardId: string | null;
      format: VaultImportFormat;
    },
  ) => api.post<VaultImportProfile>("/api/v1/vault/imports/profiles", payload),
  deleteProfile: (id: string) => api.delete<void>(`/api/v1/vault/imports/profiles/${id}`),
};
