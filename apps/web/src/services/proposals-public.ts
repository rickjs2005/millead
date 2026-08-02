import type { ApiErrorBody, PublicProposal, PublicProposalStatus } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class PublicProposalError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "PublicProposalError";
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
    throw new PublicProposalError(
      err?.error.message ?? "Não foi possível completar a ação.",
      err?.error.code,
    );
  }
  return data as T;
}

export const proposalsPublicService = {
  get: (token: string) => publicRequest<PublicProposal>(`/api/v1/public/proposals/${token}`),

  accept: (token: string) =>
    publicRequest<{ status: PublicProposalStatus }>(`/api/v1/public/proposals/${token}/accept`, {
      method: "POST",
    }),

  reject: (token: string, reason?: string) =>
    publicRequest<{ status: PublicProposalStatus }>(`/api/v1/public/proposals/${token}/reject`, {
      method: "POST",
      body: reason ? { reason } : undefined,
    }),
};
