import { useAuthStore } from "@/stores/auth-store";
import type { ApiErrorBody, SessionResult } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

// Módulo-level: dedup de refresh concorrente. Se 3 queries levarem 401 ao
// mesmo tempo, só UMA chamada de /auth/refresh sai -- o backend revoga o
// refresh token no primeiro uso (rotação atômica), então uma segunda
// chamada concorrente com o MESMO token seria tratada como reuso/roubo de
// sessão e derrubaria a sessão inteira. Esse dedup evita esse falso positivo.
let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clear();
      return false;
    }
    const data = (await res.json()) as SessionResult;
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clear();
    return false;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Pra chamadas de login/register/refresh, que não devem levar Authorization nem tentar refresh. */
  skipAuth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { method = "GET", body, query, skipAuth } = options;
  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken && !skipAuth) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipAuth && !isRetry) {
    refreshPromise ??= refreshSession().finally(() => {
      refreshPromise = null;
    });
    const refreshed = await refreshPromise;
    if (refreshed) return request<T>(path, options, true);

    useAuthStore.getState().clear();
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
  // `query` aceita qualquer objeto simples de filtros (as interfaces
  // ListXParams não têm index signature própria) -- o cast é seguro
  // porque `request` só itera as chaves via Object.entries em runtime.
  get: <T>(path: string, query?: object) =>
    request<T>(path, { query: query as RequestOptions["query"] }),
  post: <T>(path: string, body?: unknown, options?: Pick<RequestOptions, "skipAuth">) =>
    request<T>(path, { method: "POST", body, ...options }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
