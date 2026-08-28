import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  vaultImportService,
  type AnalyzePayload,
  type ConfirmPayload,
  type PreviewPayload,
} from "@/services/vault-import";
import type { VaultImportFormat, VaultImportParties, VaultImportSettings } from "@/types/api";

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * A pré-visualização é uma **mutation**, não uma query: ela não é um estado do
 * servidor que a tela observa, é uma ação que a pessoa dispara depois de
 * escolher o arquivo. Tratá-la como query faria o React Query guardar o
 * conteúdo do extrato em cache — exatamente o que este módulo evita.
 */
/**
 * Análise do arquivo — o primeiro passo do novo fluxo.
 *
 * Mutation, e não query, pelo mesmo motivo da pré-visualização: não é um
 * estado do servidor que a tela observa, é uma ação que a pessoa dispara. E,
 * mais importante, tratá-la como query faria o React Query guardar o conteúdo
 * do extrato em cache — exatamente o que este módulo evita.
 */
export function useAnalyzeImport() {
  return useMutation({
    mutationFn: (payload: AnalyzePayload) => vaultImportService.analyze(payload),
    onError: (error) => toast.error(apiMessage(error, "Não foi possível ler o arquivo.")),
  });
}

export function usePreviewImport() {
  return useMutation({
    mutationFn: (payload: PreviewPayload) => vaultImportService.preview(payload),
    onError: (error) => toast.error(apiMessage(error, "Não foi possível ler o arquivo.")),
  });
}

export function useConfirmImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ConfirmPayload) => vaultImportService.confirm(payload),
    onSuccess: async (batch) => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "imports"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "statements"] });
      // A importação dispara a classificação do lote, então os alertas podem
      // ter mudado junto.
      await queryClient.invalidateQueries({ queryKey: ["vault", "alerts"] });

      // Pessoas e Fornecedores também mudaram: a importação cadastra as
      // contrapartes que o extrato identifica por CPF/CNPJ.
      await queryClient.invalidateQueries({ queryKey: ["vault", "contacts"] });
      await queryClient.invalidateQueries({ queryKey: ["vault", "merchants"] });

      toast.success(
        batch.importedRows === 0
          ? "Nada novo — todas as linhas já estavam no Cofre."
          : `${batch.importedRows} ${batch.importedRows === 1 ? "movimentação importada" : "movimentações importadas"}.`,
        // O cadastro automático é dito em voz alta. Silencioso, ele teria o
        // mesmo problema do trabalho manual — só mais difícil de perceber.
        { description: descreverCadastro(batch.parties) },
      );
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível concluir a importação.")),
  });
}

/**
 * "2 pessoas e 1 fornecedor cadastrados" — ou nada, quando nada foi criado.
 *
 * Devolve `undefined` em vez de "0 cadastrados": uma importação que só
 * reencontrou quem já existia não tem novidade para anunciar.
 */
function descreverCadastro(p: VaultImportParties | undefined): string | undefined {
  if (!p) return undefined;
  const partes: string[] = [];
  if (p.pessoas > 0) partes.push(`${p.pessoas} ${p.pessoas === 1 ? "pessoa" : "pessoas"}`);
  if (p.fornecedores > 0) {
    partes.push(`${p.fornecedores} ${p.fornecedores === 1 ? "fornecedor" : "fornecedores"}`);
  }
  if (partes.length === 0) return undefined;
  const total = p.pessoas + p.fornecedores;
  return `${partes.join(" e ")} ${total === 1 ? "cadastrado" : "cadastrados"} automaticamente.`;
}

export function useImportHistory(limit = 20) {
  return useQuery({
    queryKey: queryKeys.vault.imports(),
    queryFn: () => vaultImportService.history(limit),
  });
}

/**
 * Desfazer importação.
 *
 * Invalida tudo que a importação alimentou: movimentações, histórico, resumo
 * do mês e alertas. Desfazer mexe nos mesmos números que importar, e um cache
 * velho mostraria movimentações que já não existem.
 */
export function useUndoImport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultImportService.undo(id),
    onSuccess: async (r) => {
      await queryClient.invalidateQueries({ queryKey: ["vault"] });
      toast.success(
        r.removidas === 0
          ? "Registro removido."
          : `Importação desfeita — ${r.removidas} ${r.removidas === 1 ? "movimentação apagada" : "movimentações apagadas"}.`,
      );
    },
    // A API recusa com 409 quando alguma movimentação baixa dívida ou virou
    // despesa da MilWeb, e a mensagem dela já nomeia o que está no caminho.
    onError: (error) => toast.error(apiMessage(error, "Não foi possível desfazer a importação.")),
  });
}

export function useImportProfiles() {
  return useQuery({
    queryKey: queryKeys.vault.importProfiles(),
    queryFn: vaultImportService.listProfiles,
  });
}

export function useCreateImportProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      payload: VaultImportSettings & {
        name: string;
        accountId: string | null;
        cardId: string | null;
        format: VaultImportFormat;
      },
    ) => vaultImportService.createProfile(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "import-profiles"] });
      toast.success("Modelo salvo — na próxima importação deste banco não precisa remapear.");
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível salvar o modelo.")),
  });
}

export function useDeleteImportProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vaultImportService.deleteProfile(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vault", "import-profiles"] });
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível remover o modelo.")),
  });
}
