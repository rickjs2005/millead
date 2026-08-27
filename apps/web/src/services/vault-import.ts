import { api } from "./api-client";
import type {
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

export const vaultImportService = {
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
