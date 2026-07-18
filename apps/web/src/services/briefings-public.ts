import type { ApiErrorBody, BriefingFile, BriefingStatus, PublicBriefing } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class PublicBriefingError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "PublicBriefingError";
  }
}

async function publicRequest<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data as ApiErrorBody | null;
    throw new PublicBriefingError(
      err?.error.message ?? "Não foi possível completar a ação.",
      err?.error.code,
    );
  }
  return data as T;
}

export interface SaveAnswerInput {
  fieldId: string;
  groupItemId?: string;
  groupItemOrder?: number;
  valueText?: string | null;
  valueJson?: unknown;
}

export const briefingsPublicService = {
  get: (token: string) => publicRequest<PublicBriefing>(`/api/v1/public/briefings/${token}`),

  saveAnswer: (token: string, input: SaveAnswerInput) =>
    publicRequest<{ ok: true }>(`/api/v1/public/briefings/${token}/answers`, {
      method: "PATCH",
      body: input,
    }),

  removeGroupItem: (token: string, groupItemId: string) =>
    publicRequest<{ ok: true }>(`/api/v1/public/briefings/${token}/answers/group-item`, {
      method: "DELETE",
      body: { groupItemId },
    }),

  createUploadToken: (
    token: string,
    input: { filename: string; contentType: string; sizeBytes: number },
  ) =>
    publicRequest<{ clientToken: string; pathname: string }>(
      `/api/v1/public/briefings/${token}/upload-token`,
      { method: "POST", body: input },
    ),

  confirmFile: (
    token: string,
    input: {
      blobUrl: string;
      pathname: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
    },
  ) =>
    publicRequest<BriefingFile>(`/api/v1/public/briefings/${token}/files`, {
      method: "POST",
      body: input,
    }),

  complete: (token: string) =>
    publicRequest<{ status: BriefingStatus }>(`/api/v1/public/briefings/${token}/complete`, {
      method: "POST",
    }),
};
