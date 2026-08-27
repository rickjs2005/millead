import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import {
  vaultImportService,
  type ConfirmPayload,
  type PreviewPayload,
} from "@/services/vault-import";
import type { VaultImportFormat, VaultImportSettings } from "@/types/api";

function apiMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

/**
 * A pré-visualização é uma **mutation**, não uma query: ela não é um estado do
 * servidor que a tela observa, é uma ação que a pessoa dispara depois de
 * escolher o arquivo. Tratá-la como query faria o React Query guardar o
 * conteúdo do extrato em cache — exatamente o que este módulo evita.
 */
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

      toast.success(
        batch.importedRows === 0
          ? "Nada novo — todas as linhas já estavam no Cofre."
          : `${batch.importedRows} ${batch.importedRows === 1 ? "movimentação importada" : "movimentações importadas"}.`,
      );
    },
    onError: (error) => toast.error(apiMessage(error, "Não foi possível concluir a importação.")),
  });
}

export function useImportHistory(limit = 20) {
  return useQuery({
    queryKey: queryKeys.vault.imports(),
    queryFn: () => vaultImportService.history(limit),
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
