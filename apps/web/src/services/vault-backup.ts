import { api, ApiError } from "./api-client";

export interface RestoreCounts {
  categorias: number;
  contas: number;
  cartoes: number;
  fornecedores: number;
  faturas: number;
  importacoes: number;
  assinaturas: number;
  movimentacoes: number;
  rateios: number;
  regras: number;
  alertas: number;
  pessoas: number;
  dividas: number;
  baixas: number;
  enviosIgnorados: number;
}

export interface ExportOutcome {
  fileName: string;
  resumo: Record<string, number>;
}

interface ApiErrorBody {
  error: { code: string; message: string };
}

/**
 * A exportação não passa pelo `api` genérico.
 *
 * Ele desserializa JSON e devolve o objeto — o que faria o Cofre inteiro
 * atravessar a memória do JS da página só para ser reserializado em seguida.
 * Aqui o corpo vira `Blob` direto e o download é disparado a partir dele: o
 * conteúdo não passa pelo estado do React, não entra em cache do React Query e
 * não sobra numa variável depois que a aba muda de tela.
 */
async function baixar(password: string, format: "json" | "csv"): Promise<ExportOutcome> {
  const res = await fetch("/api/bff/api/v1/vault/backup/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password, format }),
    credentials: "include",
    // Reforça o `no-store` que a API já manda: um arquivo com o Cofre inteiro
    // não pode encostar no cache de disco do navegador.
    cache: "no-store",
  });

  if (!res.ok) {
    const corpo = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      corpo?.error.code ?? "UNKNOWN",
      corpo?.error.message ?? "Não foi possível exportar.",
    );
  }

  const nome = nomeDoArquivo(res.headers.get("content-disposition"), format);
  const blob = await res.blob();

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.click();
  // Sem o revoke, o blob (com o Cofre inteiro) fica vivo na memória da aba
  // até ela ser fechada.
  URL.revokeObjectURL(url);

  return { fileName: nome, resumo: parseResumo(res.headers.get("x-vault-export-summary")) };
}

function nomeDoArquivo(contentDisposition: string | null, format: string): string {
  const match = contentDisposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? `millead.${format}`;
}

function parseResumo(header: string | null): Record<string, number> {
  if (!header) return {};
  try {
    return JSON.parse(header) as Record<string, number>;
  } catch {
    // Resumo é conveniência de tela; o download já aconteceu.
    return {};
  }
}

export const vaultBackupService = {
  exportar: baixar,
  restaurar: (password: string, backup: unknown) =>
    api.post<RestoreCounts>("/api/v1/vault/backup/restore", { password, backup }),
};
