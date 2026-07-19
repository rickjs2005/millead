import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/services/api-client";
import {
  authService,
  isOrganizationChoice,
  type ChangePasswordPayload,
  type LoginPayload,
  type RegisterPayload,
} from "@/services/auth";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.me(),
    queryFn: authService.me,
    enabled,
    retry: false,
  });
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (result) => {
      if (isOrganizationChoice(result)) return; // tratado pela tela (escolher org e logar de novo)
      // O BFF já gravou os cookies de sessão; aqui só populamos a store de UI.
      setSession(result);
      toast.success(`Bem-vindo de volta, ${result.user.name.split(" ")[0]}.`);
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível entrar.");
    },
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: (result) => {
      setSession(result);
      toast.success("Conta criada! Vamos começar.");
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a conta.");
    },
  });
}

export function useChangePassword() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => authService.changePassword(payload),
    onSuccess: async () => {
      // O backend revoga TODAS as sessões ao trocar a senha; força re-login
      // limpo em vez de deixar o usuário com um refresh token já revogado.
      await authService.logout().catch(() => undefined);
      clear();
      queryClient.clear();
      toast.success("Senha alterada. Entre novamente com a nova senha.");
      router.push("/login");
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível alterar a senha.");
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    // O BFF lê o refresh token do cookie, revoga no servidor e apaga os cookies.
    mutationFn: async () => {
      await authService.logout().catch(() => undefined);
    },
    onSuccess: () => {
      clear();
      queryClient.clear();
      router.push("/login");
    },
  });
}
