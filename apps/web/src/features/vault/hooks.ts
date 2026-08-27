import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/services/api-client";
import { vaultService } from "@/services/vault";

/** Estado da tela bloqueada: se está travado e quantas tentativas restam. */
export function useVaultStatus() {
  return useQuery({
    queryKey: queryKeys.vault.status(),
    queryFn: vaultService.status,
    retry: false,
  });
}

/**
 * O Cofre está aberto AGORA? Pergunta ao servidor em vez de deduzir no
 * cliente: o cookie da sessão elevada é httpOnly, então o JS não tem como
 * olhar pra ele -- e é justamente por isso que ele é seguro.
 *
 * Três respostas possíveis, e a UI trata as três: aberto (200), fechado
 * (401 VAULT_LOCKED) e "não existe Cofre" (404).
 */
export function useVaultSession() {
  return useQuery({
    queryKey: queryKeys.vault.session(),
    queryFn: vaultService.session,
    // 401/404 aqui são respostas de negócio, não falha de rede -- repetir só
    // gastaria requisição e atrasaria a tela bloqueada.
    retry: false,
    // Nunca serve resposta de cache: "o Cofre está aberto" é exatamente o
    // tipo de estado que não pode ficar velho na memória do navegador.
    staleTime: 0,
    gcTime: 0,
  });
}

/** True quando o erro é "Cofre fechado", e não "sessão do app caiu". */
export function isVaultLocked(error: unknown): boolean {
  return error instanceof ApiError && error.code === "VAULT_LOCKED";
}

/** True quando não existe Cofre pra este usuário (ou ele está desativado). */
export function isVaultMissing(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function useCreateVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: vaultService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.status() });
    },
    onError: () => toast.error("Não foi possível criar o Cofre."),
  });
}

export function useUnlockVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => vaultService.unlock(password),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.status() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.session() });
    },
    // Sem toast aqui: o erro aparece no próprio formulário, junto do campo.
    // Um toast de "senha incorreta" fica na tela depois que o usuário já
    // saiu da página -- e é justamente o tipo de aviso que não convém ficar
    // exposto.
  });
}

export function useLockVault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: vaultService.lock,
    onSuccess: async () => {
      // Limpa TODO o cache do Cofre ao fechar. Sem isto, os dados da última
      // sessão continuariam no cache do React Query e reapareceriam na tela
      // por um instante no próximo acesso, antes da nova autenticação.
      queryClient.removeQueries({ queryKey: ["vault"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.status() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.vault.session() });
    },
  });
}
