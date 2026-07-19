import type { ApiErrorBody } from "@/types/api";

/**
 * Todas as chamadas passam pelo BFF (route handlers do Next em `/api/bff`),
 * mesma origem, com cookie httpOnly -- o browser não guarda nem envia tokens.
 * O proxy do BFF (`app/api/bff/[...path]`) anexa o Bearer server-side. Os
 * caminhos lógicos (`/api/v1/...`) são preservados: `/api/bff` + `/api/v1/x`.
 */
const BFF_BASE = "/api/bff";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public issues?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Single-flight: se várias queries levarem 401 ao mesmo tempo, só UMA chamada
// de refresh sai. O backend rotaciona o refresh token no primeiro uso, então
// duas chamadas concorrentes com o mesmo token seriam tratadas como reuso e
// derrubariam a sessão inteira -- este dedup evita esse falso positivo.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  try {
    const res = await fetch(`${BFF_BASE}/auth/refresh`, { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Pra login/register/logout: não tenta refresh num 401 (credencial errada não é sessão expirada). */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, query, skipAuth } = options;
  const url = new URL(`${BFF_BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 401 && !skipAuth && !isRetry) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) return request<T>(path, options, true);

    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new ApiError(401, "UNAUTHORIZED", "Sessão expirada, faça login novamente.");
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = data as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      err?.error.code ?? "UNKNOWN_ERROR",
      err?.error.message ?? "Ocorreu um erro inesperado.",
      err?.error.issues,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: object) =>
    request<T>(path, { query: query as RequestOptions["query"] }),
  post: <T>(path: string, body?: unknown, options?: Pick<RequestOptions, "skipAuth">) =>
    request<T>(path, { method: "POST", body, ...options }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
